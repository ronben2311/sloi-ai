const router = require("express").Router();
const supabase = require("../lib/supabase");

router.post("/register", async (req, res) => {
  const { email, password, role, org_name, country } = req.body;

  if (!email || !password || !role || !org_name) {
    return res.status(400).json({ error: "email, password, role, org_name required" });
  }

  const validRoles = ["buyer", "broker", "supplier", "boss"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "invalid_role" });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return res.status(400).json({ error: authError.message });

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: org_name, type: role, country: country || null })
    .select()
    .single();
  if (orgError) return res.status(500).json({ error: orgError.message });

  const { error: userError } = await supabase.from("users").insert({
    id: authData.user.id,
    org_id: org.id,
    role,
    email,
    name: org_name,
  });
  if (userError) return res.status(500).json({ error: userError.message });

  await supabase.from("credits").insert({ user_id: authData.user.id, balance: 0 });

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

router.post("/login", async (req, res) => {
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

module.exports = router;
