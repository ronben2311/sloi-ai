const supabase = require("./supabase");

function extractPrice(text) {
  const matches = [...text.matchAll(/\$?\s*([\d,]+(?:\.\d{1,2})?)/g)];
  for (const m of matches) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (num > 0.01 && num < 1000000) return num;
  }
  return null;
}

async function generateNegId() {
  const { count } = await supabase
    .from("negotiations")
    .select("*", { count: "exact", head: true });
  return `NEG-${String((count || 0) + 1).padStart(3, "0")}`;
}

async function generateLOIRef() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { count } = await supabase
    .from("lois")
    .select("*", { count: "exact", head: true });
  return `SL-LOI-${date}-${String((count || 0) + 1).padStart(3, "0")}`;
}

function waitForBossDecision(negId, timeoutMs = 24 * 60 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        return reject(new Error("timeout"));
      }
      const { data } = await supabase
        .from("negotiations")
        .select("boss_decision, override_price")
        .eq("id", negId)
        .single();
      if (data?.boss_decision) {
        clearInterval(poll);
        resolve(data);
      }
    }, 3000);
  });
}

module.exports = { extractPrice, generateNegId, generateLOIRef, waitForBossDecision };
