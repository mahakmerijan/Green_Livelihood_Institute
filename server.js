const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_9ko6lao';
const EMAILJS_APPROVAL_TEMPLATE_ID = process.env.EMAILJS_APPROVAL_TEMPLATE_ID || 'template_gvp6exk';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '8RVJ1Y6zL-VvkLeE1';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

app.use(express.json());

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

// Keep CORS permissive for local development, including file:// origin.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.post('/api/send-approval-email', async (req, res) => {
  if (!EMAILJS_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Server missing EMAILJS_PRIVATE_KEY.' });
  }

  const { to_name, to_email, login_url, user_email, site_name } = req.body || {};
  if (!to_name || !to_email || !login_url || !user_email || !site_name) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_APPROVAL_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          to_name,
          to_email,
          login_url,
          user_email,
          site_name
        }
      })
    });

    const body = await emailRes.text();
    if (!emailRes.ok) {
      return res.status(emailRes.status).send(body || 'EmailJS request failed');
    }

    return res.status(200).send(body || 'OK');
  } catch (err) {
    const msg = err && err.message ? err.message : 'Network error';
    return res.status(500).send(msg);
  }
});

app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  const host = process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_STATIC_URL || `localhost:${PORT}`;
  const protocol = host.startsWith('http') ? '' : 'http://';
  console.log(`GLI app running on ${protocol}${host}`);

  // Self-ping every 60 seconds to prevent Render free-tier spin-down
  const SELF_URL = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/healthz`
    : null;

  if (SELF_URL) {
    setInterval(() => {
      fetch(SELF_URL)
        .then(() => console.log(`[keep-alive] pinged ${SELF_URL}`))
        .catch(err => console.warn(`[keep-alive] ping failed: ${err.message}`));
    }, 60 * 1000);
  }
});
