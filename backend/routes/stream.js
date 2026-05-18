const router = require("express").Router();
const supabase = require("../lib/supabase");
const { eventBus } = require("../lib/eventBus");

router.get("/", async (req, res) => {
  // EventSource cannot send custom headers — token arrives as query param
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: "unauthorized" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "invalid_token" });

  const { data: userRow } = await supabase
    .from("users").select("role, org_id, name").eq("id", user.id).single();
  if (!userRow) return res.status(401).json({ error: "user_not_found" });

  req.caller = { id: user.id, role: userRow.role, org_id: userRow.org_id, name: userRow.name };
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  eventBus.set(req.caller.id, { res, role: req.caller.role });

  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "HEARTBEAT", ts: Date.now() })}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    eventBus.delete(req.caller.id);
  });
});

module.exports = router;
