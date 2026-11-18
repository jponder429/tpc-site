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
    'Try Unit 1 any time: https://www.thisisponder.com/demo/', '',
    'Questions? Reply to this email and it comes straight to me.', '',
    'Jeanette Ponder', 'Founder, The Present Company', '',
    'You are receiving this because you joined the Ponder waitlist. To unsubscribe, reply with the word unsubscribe and you will be removed.',
    ADDRESS
  ].filter((l) => l !== undefined).join('\n');
  // Email styled to The Present Company design system: navy, cream and gold, Ponder wordmark with the gold sun.
  const SANS = "'Instrument Sans',Arial,Helvetica,sans-serif";
  const MONO = "'DM Mono','Courier New',monospace";
  const plaid = [['#13264A',3],['#091629',1],['#5A8EC4',1],['#13264A',3],['#2E4D3C',2],['#0C1D38',3],['#8A5A86',1],['#13264A',2]]
    .map(([c, w]) => '<td width="' + (w * 25) + '" height="8" style="background:' + c + ';font-size:0;line-height:0">&nbsp;</td>').join('');
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400&family=Instrument+Sans:wght@400;600;700&family=Schibsted+Grotesk:wght@700&display=swap" rel="stylesheet"></head>'
    + '<body style="margin:0;background:#F8F5EF;font-family:' + SANS + ';color:#0C1D38">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5EF"><tr><td align="center" style="padding:28px 12px">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #D9D3C7">'
    + '<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + plaid + '</tr></table></td></tr>'
    + '<tr><td style="background:#0C1D38;padding:24px 32px">'
    + '<span style="font-family:\'Schibsted Grotesk\',Arial,Helvetica,sans-serif;font-weight:700;font-size:30px;letter-spacing:-1.5px;color:#F8F5EF">Ponder</span>'
    + '<img src="https://thepresentco.com/assets/email-sun.png" width="13" height="13" alt="" style="display:inline-block;vertical-align:baseline;margin-left:2px;border:0"></td></tr>'
    + '<tr><td style="padding:32px 32px 8px;font-size:16px;line-height:1.6">'
    + '<p style="margin:0 0 14px;font-family:' + MONO + ';font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7F6120">AI Fundamentals &middot; Waitlist</p>'
    + '<p style="margin:0 0 16px">' + esc(hi) + '</p>'
    + '<p style="margin:0 0 16px;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.5px">You are on the waitlist for Ponder AI Ethics Fundamentals.</p>'
    + '<p style="margin:0 0 16px">Ponder is a free, plain-language AI ethics course built around one question: <em>does the documented behavior match the documented commitment?</em> Unit 1 is open now, and Units 2 to 5 are on the way. We will email you as soon as they open.</p>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td style="background:#0C1D38"><a href="https://www.thisisponder.com/demo/" style="display:inline-block;padding:14px 28px;font-family:' + SANS + ';font-size:16px;font-weight:600;color:#F8F5EF;text-decoration:none">Try Unit 1 &rarr;</a></td></tr></table>'
    + '<p style="margin:0 0 16px">Questions? Reply to this email and it comes straight to me.</p>'
    + '<p style="margin:0 0 28px">Jeanette Ponder<br><span style="color:#4B5873">Founder, The Present Company</span></p>'
    + '</td></tr>'
    + '<tr><td style="padding:18px 32px 24px;border-top:2px solid #C9A657;background:#F8F5EF;font-size:12px;line-height:1.6;color:#4B5873">'
    + '<span style="font-family:' + MONO + ';letter-spacing:2px;text-transform:uppercase;color:#7F6120">When diligence is due.</span><br>'
    + 'You are receiving this because you joined the Ponder waitlist. To unsubscribe, reply with the word <strong>unsubscribe</strong> and you will be removed.' + (ADDRESS ? '<br>' + esc(ADDRESS) : '') + '</td></tr>'
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
