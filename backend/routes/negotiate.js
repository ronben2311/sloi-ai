const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const supabase = require("../lib/supabase");
const anthropic = require("../lib/anthropic");
const { emitToRole, sseEvent } = require("../lib/eventBus");
const {
  extractPrice,
  generateNegId,
  generateLOIRef,
  waitForBossDecision,
} = require("../lib/negotiationHelpers");

router.post("/", authenticate, async (req, res) => {
  const { product, qty, unit = "MT", target_price, max_price, strategy = "standard" } = req.body;

  if (!product || !qty || !target_price || !max_price) {
    return res.status(400).json({ error: "product, qty, target_price, max_price required" });
  }

  const creditCost = strategy === "aggressive" ? 20 : 10;
  const maxRounds  = strategy === "aggressive" ? 7 : 5;

  const { error: creditError } = await supabase.rpc("decrement_credits", {
    p_user_id: req.caller.id,
    p_amount: creditCost,
  });
  if (creditError) return res.status(402).json({ error: "insufficient_credits" });

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
    product,
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
    neg_id: negId, product, qty, unit,
    buyer: req.caller.name, strategy,
    max_rounds: maxRounds, credits_used: creditCost,
  });

  let agentPrice  = parseFloat(target_price);
  let brokerPrice = parseFloat(max_price) * 1.08;
  const history   = [];

  for (let round = 1; round <= maxRounds; round++) {
    // ── Agent turn (Claude as buyer's AI) ──────────────────────────────────────
    const agentUserMsg = round === 1
      ? `Start negotiation. Make your opening offer for ${qty} ${unit} of ${product}.`
      : `Broker counter-offer: $${brokerPrice.toFixed(2)}/${unit}. Make your counter-offer.`;

    const agentStream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 120,
      system: `You are an AI procurement agent for ${req.caller.name}. Buying ${qty} ${unit} of ${product}. Target: $${target_price}/${unit}, max budget: $${max_price}/${unit}. Strategy: ${strategy}. Round ${round}/${maxRounds}. Be concise (2-3 sentences). Always include your price offer as a dollar amount.`,
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
    if (parsedAgent && parsedAgent <= max_price) agentPrice = parsedAgent;

    history.push({ role: "user", content: agentUserMsg });
    history.push({ role: "assistant", content: agentText });

    // ── Broker turn (Claude as supplier's broker) ───────────────────────────────
    const brokerStream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 120,
      system: `You are a commodity broker selling ${product}. Market price ~$${max_price}/${unit}. Buyer offered $${agentPrice.toFixed(2)}/${unit} for ${qty} ${unit}. Negotiate to maximize price. Be concise (2-3 sentences). Always include your counter-offer as a dollar amount.`,
      messages: [{ role: "user", content: `Buyer offered $${agentPrice.toFixed(2)}/${unit}. Counter-offer?` }],
    });

    let brokerText = "";
    for await (const chunk of brokerStream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        brokerText += chunk.delta.text;
        emit("TEXT_CHUNK", { role: "broker", round, token: chunk.delta.text });
      }
    }
    const parsedBroker = extractPrice(brokerText);
    if (parsedBroker && parsedBroker > agentPrice) brokerPrice = parsedBroker;

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
        neg_id: negId, product, qty, unit, deal_price: dealPrice,
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
        ref: loiRef, neg_id: negId, product, qty, unit,
        deal_price: finalPrice, total_value: finalPrice * qty,
        buyer_name: req.caller.name, supplier_ref: "REF-ANON",
        loi_fee_usd: 500, loi_fee_paid: false,
      });

      await supabase.from("negotiations").update({
        status: "completed", loi_ref: loiRef, deal_price: finalPrice,
        credits_used: creditCost + 5, updated_at: new Date().toISOString(),
      }).eq("id", negId);

      emit("LOI_GENERATED", { loi_ref: loiRef, product, qty, unit, deal_price: finalPrice, total_value: finalPrice * qty });
      emitToRole("buyer", sseEvent("LOI_GENERATED", negId, { loi_ref: loiRef, product }));

      return res.end();
    }
  }
});

module.exports = router;
