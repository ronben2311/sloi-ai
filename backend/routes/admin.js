const router  = require("express").Router();
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const xlsx    = require("xlsx");
const { authenticate, requireBoss } = require("../middleware/auth");
const supabase = require("../lib/supabase");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes("spreadsheet") || file.originalname.endsWith(".xlsx")) cb(null, true);
    else cb(new Error("Only .xlsx files allowed"));
  },
});

// ── GET /v1/admin/catalog — download the xlsx (boss only) ────────────────────

router.get("/catalog", authenticate, requireBoss, (req, res) => {
  const filePath = path.join(__dirname, "../Static/SLOI_AI_Product_Catalog.xlsx");
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "catalog_not_found" });
  res.download(filePath, "SLOI_AI_Product_Catalog.xlsx");
});

// ── POST /v1/admin/catalog/upload — parse xlsx → upsert DB (boss only) ───────

router.post("/catalog/upload", authenticate, requireBoss, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });

  try {
    const wb = xlsx.read(req.file.buffer, { type: "buffer" });

    // ── Parse Negotiation Params sheet ───────────────────────────────────────
    const paramSheet = wb.Sheets["⚡ Negotiation Params"];
    if (!paramSheet) return res.status(400).json({ error: "Missing '⚡ Negotiation Params' sheet" });

    const paramRows = xlsx.utils.sheet_to_json(paramSheet, { header: 1, defval: "" });
    // Find header row (first row where col[0] === "REF Code")
    const paramHeaderIdx = paramRows.findIndex(r => String(r[0]).trim() === "REF Code");
    if (paramHeaderIdx === -1) return res.status(400).json({ error: "Cannot find header row in Negotiation Params sheet" });

    const paramData = paramRows
      .slice(paramHeaderIdx + 1)
      .filter(r => String(r[0]).startsWith("REF-"))
      .map(r => ({
        sku:              String(r[1]).trim(),
        ref:              String(r[0]).trim(),
        product_name:     String(r[2]).trim(),
        unit:             String(r[3]).trim(),
        market_price:     parseFloat(r[4]) || null,
        walk_away:        parseFloat(r[5]) || null,
        opening_offer:    parseFloat(r[6]) || null,
        broker_floor:     parseFloat(r[7]) || null,
        max_rounds:       parseInt(r[8])   || 5,
        concession_pct:   parseFloat(String(r[10]).replace("%", "")) || 2.0,
        vol_disc_1:       String(r[11]).trim() || null,
        vol_disc_2:       String(r[12]).trim() || null,
        vol_disc_3:       String(r[13]).trim() || null,
        auto_approve:     String(r[14]).trim().toLowerCase() === "yes",
        daily_cap_orders: parseInt(r[15]) || null,
        daily_cap_usd:    parseFloat(r[16]) || null,
        synced_at:        new Date().toISOString(),
      }))
      .filter(r => r.sku); // skip blank rows

    const { error: paramError } = await supabase
      .from("negotiation_params")
      .upsert(paramData, { onConflict: "sku" });

    if (paramError) return res.status(500).json({ error: "negotiation_params upsert failed: " + paramError.message });

    // ── Parse Product Catalog sheet — update prices on existing products ─────
    const catSheet = wb.Sheets["📦 Product Catalog"];
    let pricesUpdated = 0;

    if (catSheet) {
      const catRows = xlsx.utils.sheet_to_json(catSheet, { header: 1, defval: "" });
      const catHeaderIdx = catRows.findIndex(r => String(r[0]).trim() === "REF Code");

      if (catHeaderIdx !== -1) {
        const catData = catRows
          .slice(catHeaderIdx + 1)
          .filter(r => String(r[0]).startsWith("REF-"));

        for (const r of catData) {
          const sku          = String(r[1]).trim();
          const market_price = parseFloat(r[6]);
          const moq          = parseInt(r[23]);
          const lead_time    = parseInt(r[14]);
          const certs        = String(r[25]).split(",").map(c => c.trim()).filter(Boolean);

          if (!sku || !market_price) continue;

          const { error } = await supabase
            .from("products")
            .update({
              current_price:  market_price,
              moq:            moq || undefined,
              lead_time_days: lead_time || undefined,
              certs:          certs.length ? certs : undefined,
            })
            .eq("sku", sku);

          if (!error) pricesUpdated++;
        }
      }
    }

    // Save a copy of the uploaded file (replaces the static one)
    const savePath = path.join(__dirname, "../Static/SLOI_AI_Product_Catalog.xlsx");
    fs.writeFileSync(savePath, req.file.buffer);

    return res.json({
      ok: true,
      negotiation_params_upserted: paramData.length,
      products_prices_updated: pricesUpdated,
      synced_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[catalog/upload]", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /v1/admin/users — list all users with credits + LOI counts ───────────

router.get("/users", authenticate, requireBoss, async (req, res) => {
  const [{ data: users, error }, { data: credits }, { data: lois }, { data: orgs }] = await Promise.all([
    supabase.from("users").select("id, email, name, role, org_id").order("name"),
    supabase.from("credits").select("user_id, balance"),
    supabase.from("lois").select("buyer_name"),
    supabase.from("organizations").select("id, country"),
  ]);

  if (error) return res.status(500).json({ error: error.message });

  const orgMap = {};
  (orgs || []).forEach(o => { orgMap[o.id] = o; });

  const creditMap = {};
  (credits || []).forEach(c => { creditMap[c.user_id] = c.balance; });

  const loiCountMap = {};
  (lois || []).forEach(l => { loiCountMap[l.buyer_name] = (loiCountMap[l.buyer_name] || 0) + 1; });

  return res.json((users || []).map(u => ({
    id:        u.id,
    email:     u.email,
    name:      u.name,
    role:      u.role,
    country:   (orgMap[u.org_id] || {}).country || "—",
    credits:   creditMap[u.id] ?? 0,
    loi_count: loiCountMap[u.name] || 0,
  })));
});

// ── GET /v1/admin/catalog/status — last sync info ────────────────────────────

router.get("/catalog/status", authenticate, requireBoss, async (req, res) => {
  const { data, error } = await supabase
    .from("negotiation_params")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();

  const { count } = await supabase
    .from("negotiation_params")
    .select("*", { count: "exact", head: true });

  return res.json({
    last_synced: data?.synced_at || null,
    param_count: count || 0,
  });
});

module.exports = router;
