require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase Client
// Note: We need SUPABASE_URL and SUPABASE_SERVICE_KEY in the .env file
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

// 1.3 Core API - Health Check
app.get('/health', (req, res) => {
  res.json({ ok: true, version: '1.0.0' });
});

// 1.2 Auth - Basic route placeholder
app.post('/auth/register', async (req, res) => {
  // This will handle creating user, org, and credits
  res.status(501).json({ error: 'Not implemented yet' });
});

app.listen(port, () => {
  console.log(`SLOI AI Backend running on http://localhost:${port}`);
});
