// Vercel serverless function: writes a waitlist signup into Notion (AIF General Waitlist v2).
// Requires env var NOTION_TOKEN (internal integration, shared with the waitlist database).
const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID || '64c96383-209b-4a90-9639-69a8fa5de97f';
const INDUSTRIES = ['Law','Healthcare','Finance','Technology','K-12 Education','Collegiate Education','Creative','Science / Research','Industrial / Manufacturing','Retail','Journalism / Content','HR','General / Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


const REPLY_TO = process.env.EMAIL_REPLY_TO || 'jponder@thepresentco.com';
const FROM = process.env.EMAIL_FROM || 'Jeanette at The Present Company <jponder@thepresentco.com>';
const ADDRESS = process.env.MAILING_ADDRESS || 'The Present Company, 6410 N Clark St. #1280, Chicago, IL 60640';

function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function sendConfirmation(email, name) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // email not configured yet
  const first = String(name || '').trim().split(/\s+/)[0];
  const hi = first ? 'Hi ' + first + ',' : 'Hi,';
  const text = [
    hi, '',
    'You are on the waitlist for Ponder AI Ethics Fundamentals. Thank you.', '',
    'Ponder is a free, plain-language AI ethics course built around one question: does the documented behavior match the documented commitment? Unit 1 is open now, and Units 2 to 5 are on the way. We will email you as soon as they open.', '',
    'Try Unit 1 any time: https://thepresentco.com/ponder/', '',
    'Questions? Reply to this email and it comes straight to me.', '',
    'Jeanette Ponder', 'Founder, The Present Company', '',
    'You are receiving this because you joined the Ponder waitlist. To unsubscribe, reply with the word unsubscribe and you will be removed.',
    ADDRESS
  ].filter((l) => l !== undefined).join('\n');
  const html = '<!doctype html><html><body style="margin:0;background:#f8f5ef;font-family:Arial,Helvetica,sans-serif;color:#0c1d38">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef"><tr><td align="center" style="padding:24px 12px">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-bottom:3px solid #b8943f">'
    + '<tr><td style="background:#0c1d38;padding:22px 28px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;font-weight:bold;color:#f8f5ef">Ponder<span style="color:#b8943f">.</span></td></tr>'
    + '<tr><td style="padding:30px 28px 8px;font-size:16px;line-height:1.6">'
    + '<p style="margin:0 0 16px">' + esc(hi) + '</p>'
    + '<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;line-height:1.3;font-weight:bold">You are on the waitlist for Ponder AI Ethics Fundamentals.</p>'
    + '<p style="margin:0 0 16px">Ponder is a free, plain-language AI ethics course built around one question: <em>does the documented behavior match the documented commitment?</em> Unit 1 is open now, and Units 2 to 5 are on the way. We will email you as soon as they open.</p>'
    + '<p style="margin:24px 0"><a href="https://thepresentco.com/ponder/" style="background:#b8943f;color:#0c1d38;text-decoration:none;font-family:Georgia,serif;font-weight:bold;padding:13px 26px;display:inline-block">Try Unit 1</a></p>'
    + '<p style="margin:0 0 16px">Questions? Reply to this email and it comes straight to me.</p>'
    + '<p style="margin:0 0 24px">Jeanette Ponder<br><span style="color:#5a6e84">Founder, The Present Company</span></p>'
    + '</td></tr>'
    + '<tr><td style="padding:16px 28px 24px;border-top:1px solid #ddd8cc;font-size:12px;line-height:1.5;color:#5a6e84">You are receiving this because you joined the Ponder waitlist. To unsubscribe, reply with the word <strong>unsubscribe</strong> and you will be removed.' + (ADDRESS ? '<br>' + esc(ADDRESS) : '') + '</td></tr>'
    + '</table></td></tr></table></body></html>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [email], reply_to: REPLY_TO,
        subject: 'You’re on the Ponder waitlist',
        text, html,
        headers: { 'List-Unsubscribe': '<mailto:' + REPLY_TO + '?subject=unsubscribe>' }
      })
    });
    if (!r.ok) console.error('resend_error', r.status, await r.text());
  } catch (e) { console.error('resend_exception', e && e.message); }
}

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
    // Confirmation email is best-effort: a failure here never fails the signup.
    await sendConfirmation(email, quick ? '' : name);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notion_exception', e && e.message);
    return res.status(502).json({ ok: false, error: 'upstream' });
  }
};
