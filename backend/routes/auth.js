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
    token:         session.session.access_token,
    refresh_token: session.session.refresh_token,
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
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
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

// Public config for frontend Supabase client (anon key is safe to expose)
router.get("/config", (req, res) => {
  res.json({
    supabase_url:      process.env.SUPABASE_URL,
    supabase_anon_key: process.env.SUPABASE_ANON_KEY,
  });
});

// Called after LinkedIn OAuth redirect — verifies session, creates user if new
router.post("/linkedin", async (req, res) => {
  const { access_token, refresh_token, role } = req.body;
  if (!access_token) return res.status(400).json({ error: "access_token required" });

  // Verify the Supabase token and get the LinkedIn profile
  const { data: { user }, error } = await supabase.auth.getUser(access_token);
  if (error || !user) return res.status(401).json({ error: "invalid_token" });

  // Check if user already exists in our users table
  const { data: existing } = await supabase
    .from("users")
    .select("id, role, name, org_id")
    .eq("id", user.id)
    .single();

  if (existing) {
    return res.json({
      token:         access_token,
      refresh_token: refresh_token || "",
      role:          existing.role,
      user: {
        id:     existing.id,
        email:  user.email,
        name:   existing.name,
        role:   existing.role,
        org_id: existing.org_id,
      },
    });
  }

  // New user — needs to pick a role first
  if (!role) {
    const meta = user.user_metadata || {};
    return res.json({
      needs_onboarding: true,
      profile: {
        name:     meta.full_name || meta.name || "",
        email:    user.email,
        headline: meta.headline || "",
        avatar:   meta.avatar_url || meta.picture || "",
      },
    });
  }

  // Create the new user with chosen role
  const validRoles = ["buyer", "broker"];
  if (!validRoles.includes(role)) return res.status(400).json({ error: "invalid_role" });

  const meta    = user.user_metadata || {};
  const name    = meta.full_name || meta.name || user.email.split("@")[0];
  const country = meta.locale ? meta.locale.split("_")[1] || "—" : "—";

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, type: role, country })
    .select("id")
    .single();
  if (orgError) return res.status(500).json({ error: orgError.message });

  const { error: userError } = await supabase.from("users").insert({
    id:     user.id,
    org_id: org.id,
    role,
    email:  user.email,
    name,
  });
  if (userError) return res.status(500).json({ error: userError.message });

  await supabase.from("credits").insert({
    user_id: user.id,
    balance: role === "buyer" ? 50 : 0,
  });

  return res.json({
    token:         access_token,
    refresh_token: refresh_token || "",
    role,
    user: { id: user.id, email: user.email, name, role, org_id: org.id },
  });
});

router.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: "refresh_token required" });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data.session) return res.status(401).json({ error: "refresh_failed" });

  return res.json({
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

module.exports = router;
