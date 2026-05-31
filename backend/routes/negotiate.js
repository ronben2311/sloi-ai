const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const supabase = require("../lib/supabase");
const anthropic = require("../lib/anthropic");
const { emitToRole, sseEvent } = require("../lib/eventBus");
const { Resend } = require("resend");
const {
  extractPrice,
  generateNegId,
  generateLOIRef,
  waitForBossDecision,
} = require("../lib/negotiationHelpers");

router.post("/", authenticate, async (req, res) => {
  const { product, product_ref, qty, unit = "MT", target_price, max_price, strategy = "standard" } = req.body;

  if (!product || !qty || !target_price || !max_price) {
    return res.status(400).json({ error: "product, qty, target_price, max_price required" });
  }

  const creditCost = strategy === "aggressive" ? 20 : 10;

  // ── Look up product + negotiation params ─────────────────────────────────────
  let productRow = null;
  let params     = null;

  if (product_ref) {
    const { data } = await supabase
      .from("products")
      .select("name, sku, current_price, unit, moq, certs")
      .eq("sku", product_ref)
      .single();
    productRow = data;
  }

  if (productRow?.sku) {
    const { data } = await supabase
      .from("negotiation_params")
      .select("*")
      .eq("sku", productRow.sku)
      .single();
    params = data;
  }

  // Derive key numbers — fall back to simple heuristics if no params loaded
  const productName   = productRow?.name  || product;
  const marketPrice   = params?.market_price  || parseFloat(max_price);
  const brokerFloor   = params?.broker_floor  || parseFloat(max_price) * 0.94;
  const openingOffer  = params?.opening_offer || parseFloat(max_price) * 1.08;
  const concessionPct = params?.concession_pct ?? 2.0;
  const maxRounds     = params?.max_rounds     || (strategy === "aggressive" ? 7 : 5);

  const volDiscText = [params?.vol_disc_1, params?.vol_disc_2, params?.vol_disc_3]
    .filter(Boolean).join(", ");

  // ── Deduct credits ────────────────────────────────────────────────────────────
  const { error: creditError } = await supabase.rpc("decrement_credits", {
    p_user_id: req.caller.id,
    p_amount: creditCost,
  });
  if (creditError) return res.status(402).json({ error: "insufficient_credits" });

  // ── Open SSE stream ───────────────────────────────────────────────────────────
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const negId = await generateNegId();
  const emit  = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ts: Date.now(), session_id: negId, data })}\n\n`);
  };

  await supabase.from("negotiations").insert({
    id: negId,
    product: productName,
    qty,
    unit,
    buyer_id: req.caller.id,
    buyer_name: req.caller.name,
    target_price,
    max_price,
    strategy,
    status: "running",
    max_rounds: maxRounds,
    credits_used: creditCost,
  });

  emit("NEGOTIATION_STARTED", {
    neg_id: negId, product: productName, qty, unit,
    buyer: req.caller.name, strategy,
    max_rounds: maxRounds, credits_used: creditCost,
  });

  let agentPrice  = parseFloat(target_price);
  let brokerPrice = openingOffer;
  const history   = [];

  for (let round = 1; round <= maxRounds; round++) {
    // ── Agent turn (Claude as buyer's AI) ──────────────────────────────────────
    const agentUserMsg = round === 1
      ? `Start negotiation. Make your opening offer for ${qty} ${unit} of ${productName}.`
      : `Broker counter-offer: $${brokerPrice.toFixed(2)}/${unit}. Make your counter-offer.`;

    const agentSystem = [
      `You are an AI procurement agent representing ${req.caller.name}.`,
      `Buying: ${qty} ${unit} of ${productName}.`,
      `Your target price: $${target_price}/${unit}`,
      `Your maximum budget (walk-away): $${max_price}/${unit}`,
      `Strategy: ${strategy} · Round ${round} of ${maxRounds}`,
      volDiscText ? `Volume discounts available if you secure them: ${volDiscText}` : "",
      `Rules:`,
      `- On round 1 anchor slightly below your target price`,
      `- Never reveal your maximum budget`,
      `- Concede gradually, no more than ~${concessionPct}% per round`,
      `- Be concise (2-3 sentences). Always state your offer as a dollar amount per ${unit}.`,
    ].filter(Boolean).join("\n");

    const agentStream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      system: agentSystem,
      messages: [...history, { role: "user", content: agentUserMsg }],
    });

    let agentText = "";
    for await (const chunk of agentStream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        agentText += chunk.delta.text;
        emit("TEXT_CHUNK", { role: "agent", round, token: chunk.delta.text });
      }
    }
    const parsedAgent = extractPrice(agentText);
    if (parsedAgent && parsedAgent <= parseFloat(max_price)) agentPrice = parsedAgent;

    history.push({ role: "user", content: agentUserMsg });
    history.push({ role: "assistant", content: agentText });

    // ── Broker turn (Claude as supplier's broker) ───────────────────────────────
    const brokerSystem = [
      `You are a commodity broker selling ${productName}.`,
      `Market price: $${marketPrice}/${unit}`,
      `Your opening offer: $${openingOffer.toFixed(2)}/${unit}`,
      `Your absolute floor — never go below this: $${brokerFloor.toFixed(2)}/${unit}`,
      `Buyer's current offer: $${agentPrice.toFixed(2)}/${unit} for ${qty} ${unit}`,
      `Round ${round} of ${maxRounds}`,
      volDiscText ? `You may offer volume discounts: ${volDiscText}` : "",
      `Rules:`,
      `- Concede max ${concessionPct}% per round from your last price`,
      `- NEVER go below $${brokerFloor.toFixed(2)}/${unit} — this is your hard floor`,
      `- Be professional and concise (2-3 sentences). Always state your counter-offer as a dollar amount per ${unit}.`,
    ].filter(Boolean).join("\n");

    const brokerStream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      system: brokerSystem,
      messages: [{ role: "user", content: `Buyer offered $${agentPrice.toFixed(2)}/${unit}. What is your counter-offer?` }],
    });

    let brokerText = "";
    for await (const chunk of brokerStream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        brokerText += chunk.delta.text;
        emit("TEXT_CHUNK", { role: "broker", round, token: chunk.delta.text });
      }
    }
    const parsedBroker = extractPrice(brokerText);
    // Broker price cannot go below floor
    if (parsedBroker && parsedBroker > agentPrice) {
      brokerPrice = Math.max(parsedBroker, brokerFloor);
    }

    const gapPct    = ((brokerPrice - agentPrice) / brokerPrice) * 100;
    const dealFound = gapPct <= 2.5 && agentPrice <= parseFloat(max_price);

    await supabase.from("negotiations").update({
      current_round: round,
      agent_price: agentPrice,
      broker_price: brokerPrice,
      updated_at: new Date().toISOString(),
    }).eq("id", negId);

    emit("ROUND_COMPLETE", {
      round, agent_price: agentPrice, broker_price: brokerPrice,
      gap_pct: parseFloat(gapPct.toFixed(1)),
      next_action: dealFound ? "await_human" : round >= maxRounds ? "failed" : "continue",
    });

    if (round >= maxRounds && !dealFound) {
      await supabase.from("negotiations").update({ status: "failed" }).eq("id", negId);
      emit("NEGOTIATION_FAILED", { reason: "max_rounds_reached", agent_price: agentPrice, broker_price: brokerPrice });
      return res.end();
    }

    if (dealFound) {
      const dealPrice  = parseFloat(((agentPrice + brokerPrice) / 2).toFixed(2));
      const totalValue = parseFloat((dealPrice * qty).toFixed(2));

      await supabase.from("negotiations").update({
        status: "awaiting_boss", deal_price: dealPrice, updated_at: new Date().toISOString(),
      }).eq("id", negId);

      emit("AWAIT_HUMAN", { deal_price: dealPrice, total_value: totalValue, loi_fee: 500, credits_used: creditCost });

      emitToRole("boss", sseEvent("AWAIT_HUMAN", negId, {
        neg_id: negId, product: productName, qty, unit, deal_price: dealPrice,
        total_value: totalValue, buyer: req.caller.name,
      }));

      // Email boss so he gets notified even if not in the portal
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const BOSS_EMAIL = process.env.BOSS_EMAIL || "yonparness@gmail.com";
        const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
        await resend.emails.send({
          from: FROM,
          to: BOSS_EMAIL,
          subject: `⚡ Deal needs your approval — ${productName} · $${totalValue.toLocaleString()}`,
          html: `
            <div style="font-family:monospace;background:#07070f;color:#d4d2f0;padding:32px;border-radius:8px">
              <h2 style="color:#eeedf8;margin-bottom:8px">Boss approval needed</h2>
              <p style="color:#52526e;margin-bottom:24px">A negotiation has reached a deal — your approval is required to generate the LOI.</p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
                <tr><td style="padding:8px 0;color:#52526e">Product</td><td style="color:#eeedf8;font-weight:600">${productName}</td></tr>
                <tr><td style="padding:8px 0;color:#52526e">Quantity</td><td style="color:#eeedf8">${qty} ${unit}</td></tr>
                <tr><td style="padding:8px 0;color:#52526e">Deal price</td><td style="color:#2dd4bf;font-weight:700">$${dealPrice.toFixed(2)}/${unit}</td></tr>
                <tr><td style="padding:8px 0;color:#52526e">Total value</td><td style="color:#eeedf8;font-weight:700">$${totalValue.toLocaleString()}</td></tr>
                <tr><td style="padding:8px 0;color:#52526e">Buyer</td><td style="color:#eeedf8">${req.caller.name}</td></tr>
                <tr><td style="padding:8px 0;color:#52526e">Negotiation ID</td><td style="color:#8b8ff8">${negId}</td></tr>
              </table>
              <p style="color:#52526e">Log in to <strong style="color:#5b5fef">SLOI AI Admin</strong> and open the Negotiations tab to approve or reject.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Boss email failed:", emailErr.message);
      }

      emitToRole("broker", sseEvent("AWAIT_HUMAN", negId, {
        neg_id: negId, product: productName, qty, unit, deal_price: dealPrice,
        total_value: totalValue, buyer: req.caller.name,
      }));

      let decision;
      try { decision = await waitForBossDecision(negId); }
      catch {
        emit("NEGOTIATION_FAILED", { reason: "boss_timeout" });
        return res.end();
      }

      if (decision.boss_decision === "reject") {
        await supabase.from("negotiations").update({ status: "rejected" }).eq("id", negId);
        emit("NEGOTIATION_FAILED", { reason: "boss_rejected" });
        return res.end();
      }

      await supabase.rpc("decrement_credits", { p_user_id: req.caller.id, p_amount: 5 });

      const finalPrice = parseFloat(decision.override_price || dealPrice);
      const loiRef     = await generateLOIRef();

      await supabase.from("lois").insert({
        ref: loiRef, neg_id: negId, product: productName, qty, unit,
        deal_price: finalPrice, total_value: finalPrice * qty,
        buyer_name: req.caller.name, supplier_ref: product_ref || "REF-ANON",
        loi_fee_usd: 500, loi_fee_paid: false,
      });

      await supabase.from("negotiations").update({
        status: "completed", loi_ref: loiRef, deal_price: finalPrice,
        credits_used: creditCost + 5, updated_at: new Date().toISOString(),
      }).eq("id", negId);

      emit("LOI_GENERATED", { loi_ref: loiRef, product: productName, qty, unit, deal_price: finalPrice, total_value: finalPrice * qty });
      emitToRole("buyer", sseEvent("LOI_GENERATED", negId, { loi_ref: loiRef, product: productName }));
      emitToRole("broker", sseEvent("LOI_GENERATED", negId, { loi_ref: loiRef, product: productName }));

      return res.end();
    }
  }
});

module.exports = router;
