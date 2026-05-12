require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend locally (production uses Vercel)
const path = require("path");
app.use(express.static(path.join(__dirname, "../SLOI_AI_FINAL/root")));
app.use(express.static(path.join(__dirname, "../SLOI_AI_FINAL/frontend")));
app.get("/", (req, res) => res.redirect("/m2m-homepage.html"));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────

async function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return res.status(401).json({ error: "invalid_token" });

  const { data: userRow, error: rowError } = await supabase
    .from("users")
    .select("role, org_id, name")
    .eq("id", user.id)
    .single();

  if (rowError || !userRow) return res.status(401).json({ error: "user_not_found" });

  req.caller = {
    type: "human",
    id: user.id,
    role: userRow.role,
    org_id: userRow.org_id,
    name: userRow.name,
  };

  next();
}

function requireBoss(req, res, next) {
  if (req.caller?.role !== "boss") return res.status(403).json({ error: "boss_only" });
  next();
}

// ── HEALTH ────────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ ok: true, version: "1.0.0" });
});

// ── AUTH ──────────────────────────────────────────────────────────────────────

app.post("/v1/auth/register", async (req, res) => {
  const { email, password, role, org_name, country } = req.body;

  if (!email || !password || !role || !org_name) {
    return res.status(400).json({ error: "email, password, role, org_name required" });
  }

  const validRoles = ["buyer", "broker", "supplier", "boss"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "invalid_role" });
  }

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return res.status(400).json({ error: authError.message });

  // 2. Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: org_name, type: role, country: country || null })
    .select()
    .single();
  if (orgError) return res.status(500).json({ error: orgError.message });

  // 3. Create user row
  const { error: userError } = await supabase.from("users").insert({
    id: authData.user.id,
    org_id: org.id,
    role,
    email,
    name: org_name,
  });
  if (userError) return res.status(500).json({ error: userError.message });

  // 4. Create credits row (balance 0)
  await supabase.from("credits").insert({ user_id: authData.user.id, balance: 0 });

  // 5. Sign in to get a session token back to the client
  const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (sessionError) return res.status(500).json({ error: sessionError.message });

  return res.status(201).json({
    token: session.session.access_token,
    role,
    user: {
      id: authData.user.id,
      email,
      name: org_name,
      role,
      org_id: org.id,
    },
  });
});

app.post("/v1/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: "invalid_credentials" });

  const { data: userRow, error: rowError } = await supabase
    .from("users")
    .select("role, name, org_id")
    .eq("id", data.user.id)
    .single();

  if (rowError || !userRow) return res.status(401).json({ error: "user_not_found" });

  return res.json({
    token: data.session.access_token,
    role: userRow.role,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: userRow.name,
      role: userRow.role,
      org_id: userRow.org_id,
    },
  });
});

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

app.get("/v1/products", async (req, res) => {
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

app.get("/v1/products/:ref/price", async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("ref, name, current_price, unit")
    .eq("ref", req.params.ref)
    .single();

  if (error) return res.status(404).json({ error: "product_not_found" });
  return res.json(data);
});

// ── NEGOTIATIONS ──────────────────────────────────────────────────────────────

app.get("/v1/negotiations", authenticate, async (req, res) => {
  let query = supabase
    .from("negotiations")
    .select("id, product, qty, unit, status, current_round, max_rounds, target_price, max_price, agent_price, broker_price, deal_price, supplier_ref, credits_used, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (req.caller.role === "buyer")  query = query.eq("buyer_id",  req.caller.id);
  if (req.caller.role === "broker") query = query.eq("broker_id", req.caller.id);
  // boss sees all — no filter

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.get("/v1/negotiations/:id", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("negotiations")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "negotiation_not_found" });

  // Enforce access
  if (req.caller.role === "buyer"  && data.buyer_id  !== req.caller.id) return res.status(403).json({ error: "forbidden" });
  if (req.caller.role === "broker" && data.broker_id !== req.caller.id) return res.status(403).json({ error: "forbidden" });

  return res.json(data);
});

app.post("/v1/negotiations/:id/approve", authenticate, requireBoss, async (req, res) => {
  const { action, override_price } = req.body;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

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

// ── LOIs ──────────────────────────────────────────────────────────────────────

app.get("/v1/lois", authenticate, async (req, res) => {
  let query = supabase
    .from("lois")
    .select("ref, neg_id, product, qty, unit, deal_price, total_value, buyer_name, supplier_ref, loi_fee_usd, loi_fee_paid, signed_at")
    .order("signed_at", { ascending: false });

  // Filter by buyer name for buyers (lois table stores buyer_name, not buyer_id)
  if (req.caller.role === "buyer") {
    const { data: userRow } = await supabase.from("users").select("name").eq("id", req.caller.id).single();
    if (userRow) query = query.eq("buyer_name", userRow.name);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ── CREDITS ───────────────────────────────────────────────────────────────────

app.get("/v1/credits/balance", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("credits")
    .select("balance, total_purchased, total_spent")
    .eq("user_id", req.caller.id)
    .single();

  if (error) return res.status(404).json({ error: "credits_not_found" });
  return res.json(data);
});

app.listen(port, () => {
  console.log(`SLOI AI Backend running on http://localhost:${port}`);
});
