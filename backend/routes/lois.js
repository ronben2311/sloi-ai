const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const supabase = require("../lib/supabase");

router.get("/", authenticate, async (req, res) => {
  let query = supabase
    .from("lois")
    .select("ref, neg_id, product, qty, unit, deal_price, total_value, buyer_name, supplier_ref, loi_fee_usd, loi_fee_paid, signed_at")
    .order("signed_at", { ascending: false });

  if (req.caller.role === "buyer") {
    const { data: userRow } = await supabase
      .from("users")
      .select("name")
      .eq("id", req.caller.id)
      .single();
    if (userRow) query = query.eq("buyer_name", userRow.name);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

module.exports = router;
