-- Run this in Supabase SQL Editor
-- Creates the negotiation_params table seeded by the product catalog upload

CREATE TABLE IF NOT EXISTS negotiation_params (
  sku               TEXT PRIMARY KEY,
  ref               TEXT,
  product_name      TEXT,
  unit              TEXT,
  market_price      NUMERIC,
  walk_away         NUMERIC,   -- broker's minimum (hard floor)
  opening_offer     NUMERIC,   -- broker's starting price
  broker_floor      NUMERIC,   -- absolute floor Claude cannot cross
  max_rounds        INT     DEFAULT 5,
  concession_pct    NUMERIC DEFAULT 2.0,  -- % to concede per round
  vol_disc_1        TEXT,      -- e.g. "100MT/1%"
  vol_disc_2        TEXT,
  vol_disc_3        TEXT,
  auto_approve      BOOLEAN DEFAULT false,
  daily_cap_orders  INT,
  daily_cap_usd     NUMERIC,
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Allow boss to read/write, others no access
ALTER TABLE negotiation_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boss_full_access" ON negotiation_params
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'boss'
    )
  );
