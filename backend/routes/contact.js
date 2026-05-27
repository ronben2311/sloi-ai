const express   = require("express");
const router     = express.Router();
const { Resend } = require("resend");
const rateLimit  = require("express-rate-limit");

const resend = new Resend(process.env.RESEND_API_KEY);

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 submissions per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please try again in an hour." },
});

const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
const TO   = (process.env.RESEND_TO || "hello@sloiai.com").split(",").map(e => e.trim());

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

router.post("/", contactLimiter, async (req, res) => {
  const { name, email, role, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" });
  }

  try {
    await resend.emails.send({
      from:     `SLOI AI Contact <${FROM}>`,
      to:       TO,
      reply_to: email,
      subject:  subject ? subject : `Message from ${name}`,
      html: `
        <table style="font-family:monospace;font-size:14px;color:#222;line-height:1.8">
          <tr><td style="color:#888;width:90px">Name</td><td>${esc(name)}</td></tr>
          <tr><td style="color:#888">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
          <tr><td style="color:#888">Role</td><td>${esc(role)}</td></tr>
          <tr><td style="color:#888">Subject</td><td>${esc(subject)}</td></tr>
        </table>
        <hr style="margin:18px 0;border:none;border-top:1px solid #eee"/>
        <p style="font-family:monospace;font-size:14px;color:#222;line-height:1.8">${esc(message)}</p>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Contact email error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
