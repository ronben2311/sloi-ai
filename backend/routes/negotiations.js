const router = require("express").Router();
const { authenticate, requireBoss } = require("../middleware/auth");
const supabase = require("../lib/supabase");

router.get("/", authenticate, async (req, res) => {
  let query = supabase
    .from("negotiations")
    .select("id, product, qty, unit, buyer_name, status, current_round, max_rounds, target_price, max_price, agent_price, broker_price, deal_price, supplier_ref, credits_used, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (req.caller.role === "buyer") query = query.eq("buyer_id", req.caller.id);
  // broker and boss see all — no filter

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

router.get("/:id", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("negotiations")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "negotiation_not_found" });

  if (req.caller.role === "buyer"  && data.buyer_id  !== req.caller.id) return res.status(403).json({ error: "forbidden" });
  if (req.caller.role === "broker" && data.broker_id !== req.caller.id) return res.status(403).json({ error: "forbidden" });

  return res.json(data);
});

router.post("/:id/approve", authenticate, requireBoss, async (req, res) => {
  const { action, override_price } = req.body;
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be approve or reject" });
  }

  const { data, error } = await supabase
    .from("negotiations")
    .update({
      boss_decision: action,
      override_price: override_price || null,
      status: action === "approve" ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(404).json({ error: "negotiation_not_found" });
  return res.json(data);
});

module.exports = router;
