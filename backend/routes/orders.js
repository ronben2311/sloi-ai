const express   = require("express");
const router     = express.Router();
const { Resend } = require("resend");
const rateLimit  = require("express-rate-limit");

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
const TO   = (process.env.RESEND_TO  || "hello@sloiai.com").split(",").map(e => e.trim());

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

function esc(str) {
  return String(str || "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

router.post("/", orderLimiter, async (req, res) => {
  const { product, qty, unit, buyer_name, buyer_telegram, country, notes, max_price } = req.body;

  if (!product || !qty || !buyer_name) {
    return res.status(400).json({ error: "product, qty and buyer_name are required" });
  }

  try {
    await resend.emails.send({
      from:    `SLOI AI Orders <${FROM}>`,
      to:      TO,
      subject: `New Order — ${product} · ${qty} ${unit || "MT"} · ${country || "—"}`,
      html: `
        <div style="font-family:monospace;font-size:14px;color:#222;max-width:560px">
          <div style="background:#5b5fef;color:#fff;padding:14px 20px;border-radius:8px 8px 0 0;font-weight:700;font-size:16px">
            📦 New Procurement Request
          </div>
          <div style="border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;padding:20px">
            <table style="width:100%;border-collapse:collapse">
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="color:#888;padding:8px 0;width:140px">Product</td>
                <td style="font-weight:600;padding:8px 0">${esc(product)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="color:#888;padding:8px 0">Quantity</td>
                <td style="font-weight:600;padding:8px 0">${esc(qty)} ${esc(unit)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="color:#888;padding:8px 0">Budget ceiling</td>
                <td style="font-weight:600;padding:8px 0">${max_price ? "$" + esc(max_price) : "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="color:#888;padding:8px 0">Delivery country</td>
                <td style="font-weight:600;padding:8px 0">${esc(country)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="color:#888;padding:8px 0">Buyer name</td>
                <td style="font-weight:600;padding:8px 0">${esc(buyer_name)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="color:#888;padding:8px 0">Telegram</td>
                <td style="font-weight:600;padding:8px 0;color:#5b5fef">${esc(buyer_telegram)}</td>
              </tr>
              <tr>
                <td style="color:#888;padding:8px 0">Notes</td>
                <td style="padding:8px 0;color:#555">${esc(notes)}</td>
              </tr>
            </table>
          </div>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Order email error:", err);
    res.status(500).json({ error: "Failed to send order" });
  }
});

module.exports = router;
