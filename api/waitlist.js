// Vercel serverless function: writes a waitlist signup into Notion (AIF General Waitlist v2).
// Requires env var NOTION_TOKEN (internal integration, shared with the waitlist database).
const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID || '64c96383-209b-4a90-9639-69a8fa5de97f';
const INDUSTRIES = ['Law','Healthcare','Finance','Technology','K-12 Education','Collegiate Education','Creative','Science / Research','Industrial / Manufacturing','Retail','Journalism / Content','HR','General / Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.NOTION_TOKEN;
  // Health check: open /api/waitlist in a browser. Reports only whether the token is present, never its value.
  if (req.method === 'GET') return res.status(200).json({ configured: Boolean(token) });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  if (!token) { console.error('waitlist: NOTION_TOKEN is not set for this deployment'); return res.status(503).json({ ok: false, error: 'not_configured' }); }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: pretend success

  const quick = b.quick === true; // email-only signup from /ponder/join (consent shown as a notice on that page)
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const name = String(b.name || '').trim().slice(0, 120) || (quick ? email : '');
  const industry = INDUSTRIES.includes(b.industry) ? b.industry : null;
  let source = b.source === 'Ponder demo' ? 'Ponder demo' : 'Ponder page';
  if (quick) {
    const tag = String(b.src || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    source = 'Ponder quick add' + (tag ? ' - ' + tag : '');
  }
  if (!name || !EMAIL_RE.test(email) || (!quick && b.consent !== true)) return res.status(400).json({ ok: false, error: 'invalid' });

  const properties = {
    'Name': { title: [{ text: { content: name } }] },
    'Email': { email },
    'Waitlist': { select: { name: 'AIF General' } },
    'Source': { rich_text: [{ text: { content: source } }] },
    'Consent': { checkbox: true },
    'Submitted At': { date: { start: new Date().toISOString() } }
  };
  if (industry) properties['Industry'] = { select: { name: industry } };

  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: DATA_SOURCE_ID }, properties })
    });
    if (!r.ok) { console.error('notion_error', r.status, await r.text()); return res.status(502).json({ ok: false, error: 'upstream' }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notion_exception', e && e.message);
    return res.status(502).json({ ok: false, error: 'upstream' });
  }
};
