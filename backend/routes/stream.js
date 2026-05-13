const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { eventBus } = require("../lib/eventBus");

router.get("/", authenticate, (req, res) => {
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
