const supabase = require("../lib/supabase");

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

module.exports = { authenticate, requireBoss };
