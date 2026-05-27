require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend locally (production uses Vercel)
app.use(express.static(path.join(__dirname, "../SLOI_AI_FINAL/root")));
app.use(express.static(path.join(__dirname, "../SLOI_AI_FINAL/frontend")));
app.get("/", (req, res) => res.redirect("/m2m-homepage.html"));

// Health
app.get("/health", (req, res) => res.json({ ok: true, version: "1.0.0" }));

// API routes
app.use("/v1/auth",         require("./routes/auth"));
app.use("/v1/chat",         require("./routes/chat"));
app.use("/v1/products",     require("./routes/products"));
app.use("/v1/stream",       require("./routes/stream"));
app.use("/v1/negotiate",    require("./routes/negotiate"));
app.use("/v1/negotiations", require("./routes/negotiations"));
app.use("/v1/lois",         require("./routes/lois"));
app.use("/v1/credits",      require("./routes/credits"));
app.use("/v1/admin",        require("./routes/admin"));

app.listen(port, () => {
  console.log(`SLOI AI Backend running on http://localhost:${port}`);
});
