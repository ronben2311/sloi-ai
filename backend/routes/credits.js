const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const supabase = require("../lib/supabase");

router.get("/balance", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("credits")
    .select("balance, total_purchased, total_spent")
    .eq("user_id", req.caller.id)
    .single();

  if (error) return res.status(404).json({ error: "credits_not_found" });
  return res.json(data);
});

module.exports = router;
