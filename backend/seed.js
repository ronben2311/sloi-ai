require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function seed() {
  console.log("Seeding SLOI AI demo data...\n");

  // ── 1. LOOK UP DEMO USER IDs ──────────────────────────────────────────────
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, role")
    .in("email", [
      "buyer@demo.sloiai.com",
      "broker@demo.sloiai.com",
      "supplier@demo.sloiai.com",
    ]);

  if (usersError) { console.error("Users lookup failed:", usersError.message); process.exit(1); }

  const buyer    = users.find(u => u.role === "buyer");
  const broker   = users.find(u => u.role === "broker");
  const supplier = users.find(u => u.role === "supplier");

  console.log("Found users:");
  console.log("  Buyer:   ", buyer?.id);
  console.log("  Broker:  ", broker?.id);
  console.log("  Supplier:", supplier?.id);

  // ── 2. SEED CREDITS ───────────────────────────────────────────────────────
  console.log("\nAdding credits...");

  await supabase.rpc("increment_credits", { p_user_id: buyer.id,  p_amount: 320 });
  await supabase.rpc("increment_credits", { p_user_id: broker.id, p_amount: 150 });

  // Log the purchases
  await supabase.from("credit_transactions").insert([
    { user_id: buyer.id,  credits: 320, source: "stripe", action: "purchase", amount_usd: 299 },
    { user_id: broker.id, credits: 150, source: "stripe", action: "purchase", amount_usd: 99  },
  ]);

  console.log("  Buyer  → 320 credits");
  console.log("  Broker → 150 credits");

  // ── 3. SEED PRODUCTS ──────────────────────────────────────────────────────
  console.log("\nInserting products...");

  const products = [
    { ref: "REF-MET-001", supplier_id: supplier.id, sector: "Metals",      name: "Steel Rebar G60 12mm",  sku: "STL-12",    unit: "MT",   current_price: 2840,  moq: 10,   lead_time_days: 7,  certs: ["ISO 3834", "CE"],          active: true },
    { ref: "REF-MET-002", supplier_id: supplier.id, sector: "Metals",      name: "Steel HR Coil SS400",   sku: "STL-HRC",   unit: "MT",   current_price: 3100,  moq: 20,   lead_time_days: 10, certs: ["ISO 3834"],                 active: true },
    { ref: "REF-MET-003", supplier_id: supplier.id, sector: "Metals",      name: "Aluminum 6061-T6",      sku: "ALU-6061",  unit: "MT",   current_price: 9200,  moq: 5,    lead_time_days: 8,  certs: ["CE", "REACH"],              active: true },
    { ref: "REF-BLD-001", supplier_id: supplier.id, sector: "Building",    name: "Concrete Block 20cm",   sku: "BLK-200",   unit: "Unit", current_price: 4.8,   moq: 1000, lead_time_days: 3,  certs: ["ISO 9001"],                 active: true },
    { ref: "REF-BLD-002", supplier_id: supplier.id, sector: "Building",    name: "Ready-Mix Concrete B25",sku: "CNC-B25",   unit: "m3",   current_price: 380,   moq: 10,   lead_time_days: 2,  certs: ["ISO 9001"],                 active: true },
    { ref: "REF-BLD-003", supplier_id: supplier.id, sector: "Building",    name: "Porcelain Tile 60x60cm",sku: "TLE-6060",  unit: "m2",   current_price: 62,    moq: 100,  lead_time_days: 5,  certs: ["ISO 9001"],                 active: true },
    { ref: "REF-BLD-004", supplier_id: supplier.id, sector: "Building",    name: "PVC Pipe 110mm",        sku: "PVC-110",   unit: "m",    current_price: 28,    moq: 500,  lead_time_days: 4,  certs: ["CE"],                       active: true },
    { ref: "REF-ENE-001", supplier_id: supplier.id, sector: "Energy",      name: "Industrial Diesel B2",  sku: "DSL-B2",    unit: "Liter",current_price: 4.92,  moq: 5000, lead_time_days: 2,  certs: ["ISO 14001"],                active: true },
    { ref: "REF-AGR-001", supplier_id: supplier.id, sector: "Agriculture", name: "Hard Wheat",            sku: "WHT-HRD",   unit: "MT",   current_price: 1120,  moq: 50,   lead_time_days: 14, certs: ["ISO 22000"],                active: true },
    { ref: "REF-AGR-002", supplier_id: supplier.id, sector: "Agriculture", name: "Yellow Corn",           sku: "CRN-YLW",   unit: "MT",   current_price: 980,   moq: 50,   lead_time_days: 14, certs: ["ISO 22000"],                active: true },
    { ref: "REF-CHM-001", supplier_id: supplier.id, sector: "Chemicals",   name: "Sulfuric Acid 98%",     sku: "H2SO4",     unit: "MT",   current_price: 580,   moq: 5,    lead_time_days: 7,  certs: ["REACH"],                    active: true },
  ];

  const { error: prodError } = await supabase.from("products").upsert(products);
  if (prodError) { console.error("Products insert failed:", prodError.message); }
  else console.log(`  Inserted ${products.length} products`);

  // ── 4. VERIFY ─────────────────────────────────────────────────────────────
  console.log("\nVerifying...");

  const { data: credits } = await supabase
    .from("credits")
    .select("user_id, balance")
    .in("user_id", [buyer.id, broker.id]);

  credits.forEach(c => {
    const u = users.find(u => u.id === c.user_id);
    console.log(`  ${u?.email}: ${c.balance} credits`);
  });

  const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
  console.log(`  Products in DB: ${count}`);

  console.log("\nDone.");
}

seed().catch(console.error);
