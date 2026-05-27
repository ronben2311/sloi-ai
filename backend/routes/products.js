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

router.get("/:sku/params", async (req, res) => {
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("name, sku, unit, current_price, moq")
    .eq("sku", req.params.sku)
    .single();

  if (pErr) return res.status(404).json({ error: "product_not_found" });

  const { data: params } = await supabase
    .from("negotiation_params")
    .select("market_price, walk_away, opening_offer, broker_floor, max_rounds, concession_pct")
    .eq("sku", req.params.sku)
    .single();

  return res.json({
    sku:           product.sku,
    name:          product.name,
    unit:          product.unit,
    moq:           product.moq,
    market_price:  params?.market_price  ?? product.current_price,
    walk_away:     params?.walk_away     ?? null,
    opening_offer: params?.opening_offer ?? null,
    broker_floor:  params?.broker_floor  ?? null,
    max_rounds:    params?.max_rounds    ?? 5,
    concession_pct: params?.concession_pct ?? 2.0,
  });
});

module.exports = router;
