const router    = require("express").Router();
const anthropic = require("../lib/anthropic");

// POST /v1/chat  — proxy Claude calls from the frontend (keeps API key server-side)
// No auth required: Claude key never leaves the server, CORS limits browser access
router.post("/", async (req, res) => {
  const { messages, system, max_tokens = 400 } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens,
      system:     system || "",
      messages,
    });

    return res.json({ text: response.content?.[0]?.text || "" });
  } catch (err) {
    console.error("[chat]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
