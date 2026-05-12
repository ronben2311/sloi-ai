# SLOI AI — Developer README
**Version:** 2.0 · May 2026  
**Stack:** Node.js + Express · Supabase · Claude API · Telegraf · Railway · Vercel  
**Contact:** api@sloiai.com

---

## Start here — read in this order

1. `frontend/summary.html` — 1-page executive overview (open in browser)
2. `frontend/tech-spec.html` — full technical spec with 4 build phases
3. `frontend/payments.html` — Stripe + USDC + TON implementation
4. `frontend/agui.html` — AG-UI SSE protocol (negotiation stream)
5. `frontend/telegram-bot.html` — Telegram bot + channel + inline bot
6. `frontend/autonomous-mode.html` — mandate engine + auto-approve logic
7. `frontend/telegram-bot.html` — optional orchestration layer (skip if Telegram-first)

---

## What SLOI AI does (2 sentences)

Buyers or AI agents set a price mandate. SLOI AI's Claude-powered agent negotiates with a verified supplier, Boss approves, and a signed Letter of Intent (LOI) is generated instantly. Scope: negotiation + LOI only — no escrow, no payments, no shipping.

---

## Architecture

```
Buyer/Agent (browser or API)
        ↓ HTTPS + SSE (AG-UI)
api.sloiai.com → Railway (Node.js + Express)
        ↓                    ↓
   Supabase DB          Claude API
   (PostgreSQL)         (claude-sonnet-4-20250514)
        ↓
   Event bus → AG-UI stream → all portals
             → Telegram Bot → Boss
             → @SloiAIExchange channel

Payments:
  Human  → Stripe checkout → webhook → credits
  Agent  → USDC on Base → Alchemy webhook → credits
  Telegram → TON → Tonhub webhook → credits
```

---

## Day 1 checklist

### Before writing a single line of code:

- [ ] Create Supabase project at supabase.com
- [ ] Run DB schema SQL from `frontend/tech-spec.html` → Phase 1 → DB Schema
- [ ] Create Railway project, connect GitHub repo
- [ ] Set all ENV variables (see list below)
- [ ] Create Telegram bot via BotFather (5 min)
- [ ] Register `sloiai.com` domain
- [ ] Deploy frontend/ to Vercel (drag & drop)

### First endpoint to build:

```
GET /health → {ok: true, version: "1.0.0"}
```

Railway uses this for health checks. Build it first, deploy, confirm Railway is working.

### Second:

```
POST /auth/register → creates user + org + credits(0) + returns JWT
```

Without auth, nothing else works.

---

## File map — what each file does

### Portals (deploy to Vercel as static HTML)

| File | URL | Role | Notes |
|------|-----|------|-------|
| `m2m-homepage.html` | `/` or `/index.html` | Public homepage | Rename to index.html on Vercel |
| `login.html` | `/login.html` | Auth + role routing | Redirects by role after JWT |
| `CommodEx_Admin.html` | `/admin.html` | Boss portal | Requires role=boss |
| `CommodEx_Platform.html` | `/app.html` | Buyer portal | Requires role=buyer |
| `CommodEx_Broker.html` | `/broker.html` | Broker portal | Requires role=broker |
| `negotiation-agent.html` | `/console.html` | Agent Console | Claude API direct + backend |
| `telegram-mini-app.html` | `/telegram-mini-app.html` | Telegram Mini App | Set as Bot Web App URL |
| `exchange.html` | `/exchange.html` | Public exchange | No auth required |

### Root files (deploy to sloiai.com root)

| File | URL | Purpose |
|------|-----|---------|
| `api-client.js` | `/api-client.js` | Shared JS for all portals |
| `skill.md` | `/skill.md` | MCP skill for AI agents |
| `llms.txt` | `/llms.txt` | AI discovery (short) |
| `llms-full.txt` | `/llms-full.txt` | AI discovery (full) |
| `openapi.yaml` | `/openapi.yaml` | OpenAPI 3.1 spec |
| `seo-geo.js` | `/seo-geo.js` | SEO + GEO plugin |
| `robots.txt` | `/robots.txt` | AI crawler permissions |

### Developer reference (open in browser, don't deploy)

| File | What's inside |
|------|---------------|
| `tech-spec.html` | Full build spec — 4 phases, DB schema, API endpoints, ENV |
| `payments.html` | Stripe + Base/USDC + TON full implementation with code |
| `agui.html` | AG-UI SSE protocol — events, backend code, frontend client |
| `telegram-bot.html` | Telegram bot — full Telegraf code, channel, inline, TON |
| `autonomous-mode.html` | Mandate engine, auto-approve conditions, DB schema |
| `telegram-bot.html` | Telegram Bot orchestration (optional — Telegram-first instead) |
| `summary.html` | 1-page executive summary |

---

## API endpoints — all 18

```
Auth
POST   /auth/register              Create user + org + credits
POST   /auth/login                 Returns JWT

Products (no auth)
GET    /v1/products                List all · ?sector=metals|building|energy|agriculture|chemicals
GET    /v1/products/:ref/price     Price + 7-day history

Credits
GET    /v1/credits/balance         Current balance
POST   /v1/credits/purchase        Stripe URL (human) or USDC instructions (agent)

Negotiations
POST   /v1/negotiate               Start → SSE stream (AG-UI events)
GET    /v1/negotiations            List (RLS filtered by role)
GET    /v1/negotiations/:id        Single negotiation
POST   /v1/negotiations/:id/approve  {action:"approve"|"reject"} · Boss only

Stream
GET    /v1/stream                  Global SSE · all events for this user

LOI
GET    /v1/lois                    List LOIs
GET    /v1/lois/:ref/pdf           Download PDF

Mandates (autonomous mode)
POST   /v1/mandates                Create mandate · auto_approve:true = autonomous
GET    /v1/mandates                List mandates
DELETE /v1/mandates/:id            Cancel mandate

Agents
POST   /v1/agents/register         Register AI agent → api_key
GET    /v1/agents/:id/reputation   Tier + floor discount

Compliance
POST   /v1/compliance/check        Screen entity (OFAC + EU + UN)

Webhooks
POST   /webhooks/stripe            checkout.session.completed → credits
POST   /webhooks/base              USDC transfer → credits
POST   /webhooks/ton               TON transfer → credits
POST   /webhooks/telegram          Telegram bot updates
```

---

## Build phases — exact order

### Phase 1 — Foundation (Weeks 1–2)
**Goal: auth works, credits work, products return data**

1. Supabase schema (copy SQL from tech-spec.html → Phase 1 → DB Schema)
2. `GET /health`
3. `POST /auth/register` + `POST /auth/login`
4. `authenticate()` middleware (JWT + API key)
5. `GET /v1/products` + `GET /v1/products/:ref/price`
6. `GET /v1/credits/balance`
7. `POST /v1/credits/purchase` → Stripe checkout
8. `POST /webhooks/stripe` → addCredits()
9. `decrement_credits()` RPC (atomic, throws if insufficient)

**Test:** register → login → get products → buy credits → check balance

### Phase 2 — Agents (Weeks 3–5)
**Goal: full negotiation → LOI generated**

1. `POST /v1/negotiate` → SSE stream with AG-UI events
   - TEXT_CHUNK per token (Claude streaming)
   - ROUND_COMPLETE after each round
   - AWAIT_HUMAN when deal reached
2. `POST /v1/negotiations/:id/approve` → Boss approves
3. LOI PDF generation (puppeteer → Supabase Storage)
4. `GET /v1/lois` + `GET /v1/lois/:ref/pdf`
5. `GET /v1/stream` → global SSE + eventBus
6. `agui-client.js` injection in all portals (already has `<script>` tag)
7. Base/USDC webhook (`POST /webhooks/base`)
8. `POST /v1/mandates` → autonomous mode
9. `checkAutoApprove()` function (copy from autonomous-mode.html)

**Test:** negotiate → stream events → approve → LOI PDF → download

### Phase 3 — Telegram (Weeks 6–7)
**Goal: Boss approves deals from Telegram**

1. `npm install telegraf node-cron`
2. Create `routes/telegram.js` (copy from telegram-bot.html)
3. `POST /webhooks/telegram` endpoint
4. Set webhook: `curl .../setWebhook`
5. Channel cron job (price updates every 30 min)
6. TON webhook (`POST /webhooks/ton`)
7. `POST /v1/agents/register` → Open Network
8. `POST /v1/compliance/check` → OpenSanctions

**Test:** message bot "status" → get response → trigger deal → get AWAIT_HUMAN in Telegram → reply "approve" → LOI generated

### Phase 4 — Scale (Weeks 8+)
1. Agent reputation system (`agent_reputation` table)
2. Floor price discounts per tier
3. Mobile PWA (service worker + push)
4. TradeFinex referral links
5. Analytics dashboard

---

## ENV variables — all 22

Copy this to Railway → Variables:

```bash
# Core
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://sloiai.com
JWT_SECRET=<generate: openssl rand -hex 32>

# Claude API
ANTHROPIC_API_KEY=sk-ant-...
# Get from: console.anthropic.com

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJh...
SUPABASE_ANON_KEY=eyJh...
# Get from: supabase.com → Project Settings → API

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_99=price_...
STRIPE_PRICE_ID_299=price_...
STRIPE_PRICE_ID_599=price_...
STRIPE_PRICE_ID_999=price_...
# Get from: dashboard.stripe.com → Products (create 4 one-time products)

# Base / USDC (Coinbase)
SLOI_AI_WALLET_ADDRESS=0x...
SLOI_AI_WALLET_PRIVATE_KEY=0x...
ALCHEMY_API_KEY=...
ALCHEMY_WEBHOOK_AUTH=...
# Get from: coinbase.com/cloud (CDP) + alchemy.com

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOSS_CHAT_ID=...
TELEGRAM_CHANNEL_ID=@SloiAIExchange
# Get from: BotFather → /newbot
# Boss chat ID: message @userinfobot

# TON
SLOI_TON_WALLET=EQ...
TONHUB_API_KEY=...
# Get from: tonkeeper.com (create wallet) + getblock.io

# Email
RESEND_API_KEY=re_...
# Get from: resend.com → API Keys

# Compliance
OPENSANCTIONS_API_KEY=...
# Get from: opensanctions.org/api
```

---

## Non-negotiables — read before coding

**1. Boss approval is hardcoded**  
No LOI is ever generated without Boss action. The `AWAIT_HUMAN` event fires and the stream pauses. Only `POST /v1/negotiations/:id/approve` from a `boss` role unblocks it. Exception: autonomous mode with `auto_approve:true` mandate — even then, `deal_price <= max_price` is enforced server-side.

**2. Supplier anonymization**  
Suppliers are identified by REF codes only (REF-MET-001). Never expose `supplier_id` or real names in any API response to buyers. Enforced by Supabase RLS — not just API filtering.

**3. Compliance before every deal**  
Auto-screen every buyer and deal before negotiation starts. Blocked verdict → 451 error, deal stops. No exceptions.

**4. Credits deducted atomically**  
Always use `decrement_credits()` RPC — never plain `UPDATE credits SET balance = balance - X`. The RPC throws if balance insufficient. Check before starting any paid agent action.

**5. X-Accel-Buffering: no**  
Add this header to all SSE endpoints on Railway, or nginx will buffer the stream and the frontend won't receive events in real time.

---

## Key decisions already made

| Decision | What | Why |
|----------|------|-----|
| Telegram first | Primary Boss interface | No Meta approval, instant, TON native |
| Claude API direct | Agent Console uses direct API | Works now without backend |
| Supabase RLS | Security layer | Supplier anonymization enforced at DB |
| AG-UI SSE | Real-time stream | All portals update simultaneously |
| LOI only | Scope | No escrow/shipping = 98% gross margin |
| $500 LOI fee | Revenue | Underpriced ~10x intentionally to capture market |
| Credits never expire | Retention | Lower friction for purchase |

---

## Helpful reference pages

All open in browser — no server needed:

- `ton-connect.html` — TON Connect spec + Jettons + LOI NFT
- `agent-auth.html` — Agent auth: register, api_key, Python/Node/Claude/cURL examples
- `a2a.html` — A2A protocol spec + Agent Card + Python examples
- `sitemap.html` — all pages with descriptions and links
- `agui.html` — AG-UI events reference with code examples
- `autonomous-mode.html` — mandate + auto-approve backend logic
- `payments.html` — Stripe + USDC + TON full code
- `telegram-bot.html` — complete Telegraf bot code

---

## Economics

```
Infrastructure/month:  ~$90
  Railway:   $20
  Supabase:  $25
  Claude API: ~$30 (variable)
  Resend:    $0 (free tier)
  Alchemy:   $0 (free tier)
  Vercel:    $0 (free tier)

Break-even: 1 LOI/month at $500 fee

10 LOIs/month:  $5,000 revenue · $90 cost · 98% margin
100 LOIs/month: $50,000 revenue · $90 cost · 99% margin
```

---

## Questions?

api@sloiai.com  
All technical specs: open `tech-spec.html` in browser  
API reference: `openapi.yaml` (import to Postman or Insomnia)


## Legal

- `frontend/privacy.html` — Privacy Policy (GDPR + UAE PDPL)
- `frontend/risk-disclosure.html` — Risk Disclosure
- `frontend/terms.html` — Terms of Service
