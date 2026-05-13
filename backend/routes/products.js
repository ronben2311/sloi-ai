const router = require("express").Router();
const supabase = require("../lib/supabase");

router.get("/", async (req, res) => {
  const { sector } = req.query;
  let query = supabase
    .from("products")
    .select("ref, sector, name, sku, unit, current_price, moq, lead_time_days, certs")
    .eq("active", true)
    .order("sector");

  if (sector) query = query.eq("sector", sector);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

router.get("/:ref/price", async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("ref, name, current_price, unit")
    .eq("ref", req.params.ref)
    .single();

  if (error) return res.status(404).json({ error: "product_not_found" });
  return res.json(data);
});

module.exports = router;
