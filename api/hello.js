// Vercel serverless function: sends the welcome email for The Present Company newsletter.
// The sign-up itself is stored by the Google Apps Script (window.TPC_FORM_URL); this only sends the email.
// Requires env var RESEND_API_KEY, with thepresentco.com verified as a sending domain in Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FROM = 'The Present Company <hello@thepresentco.com>';
const REPLY_TO = 'jponder@thepresentco.com';
const ADDRESS = 'The Present Company, 6410 N Clark St. #1280, Chicago, IL 60640';

const COPY = {
  en: {
    subject: 'You’re subscribed to The Present Company newsletter',
    eyebrow: 'Newsletter',
    head: 'Thank you for subscribing.',
    body: [
      'Each issue covers new AI rules, real cases and practical steps you can take to reduce AI risk, document your due diligence, and protect yourself and your organization from liability.',
      'Questions or ideas for an issue? Reply to this email and it comes straight to me.'
    ],
    title: 'Founder and CEO, The Present Company',
    foot: 'You are receiving this because you subscribed at thepresentco.com. To unsubscribe, reply with the word unsubscribe and we will remove you.',
    btn: 'Visit The Present Company'
  },
  es: {
    subject: 'Ya estás suscrito al boletín de The Present Company',
    eyebrow: 'Boletín',
    head: 'Gracias por suscribirte.',
    body: [
      'Cada número trae nuevas reglas de IA, casos reales y pasos prácticos para reducir el riesgo de la IA, documentar tu debida diligencia y protegerte a ti y a tu organización de la responsabilidad legal.',
      '¿Preguntas o ideas para un número? Responde a este correo y me llega directamente.'
    ],
    title: 'Fundadora y CEO, The Present Company',
    foot: 'Recibes este correo porque te suscribiste en thepresentco.com. Para darte de baja, responde con la palabra baja y te quitaremos de la lista.',
    btn: 'Visita The Present Company'
  }
};

function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function build(lang) {
  const c = COPY[lang];
  const SANS = "'Instrument Sans',Arial,Helvetica,sans-serif";
  const MONO = "'DM Mono','Courier New',monospace";
  const plaid = [['#13264A',3],['#091629',1],['#5A8EC4',1],['#13264A',3],['#2E4D3C',2],['#0C1D38',3],['#8A5A86',1],['#13264A',2]]
    .map(([col, w]) => '<td width="' + (w * 25) + '" height="8" style="background:' + col + ';font-size:0;line-height:0">&nbsp;</td>').join('');
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;background:#F8F5EF;font-family:' + SANS + ';color:#0C1D38">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5EF"><tr><td align="center" style="padding:28px 12px">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #D9D3C7">'
    + '<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + plaid + '</tr></table></td></tr>'
    + '<tr><td style="background:#0C1D38;padding:22px 32px;font-weight:700;font-size:22px;letter-spacing:-0.5px;color:#F8F5EF">The Present Company</td></tr>'
    + '<tr><td style="padding:32px 32px 8px;font-size:16px;line-height:1.6">'
    + '<p style="margin:0 0 14px;font-family:' + MONO + ';font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7F6120">' + esc(c.eyebrow) + '</p>'
    + '<p style="margin:0 0 16px;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.5px">' + esc(c.head) + '</p>'
    + c.body.map((p) => '<p style="margin:0 0 16px">' + esc(p) + '</p>').join('')
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#0C1D38"><a href="https://www.thepresentco.com/' + (lang === 'es' ? 'es/' : '') + '" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#F8F5EF;text-decoration:none">' + esc(c.btn) + ' &rarr;</a></td></tr></table>'
    + '<p style="margin:0 0 28px">Jeanette Ponder<br><span style="color:#4B5873">' + esc(c.title) + '</span></p>'
    + '</td></tr>'
    + '<tr><td style="padding:18px 32px 24px;border-top:2px solid #C9A657;background:#F8F5EF;font-size:12px;line-height:1.6;color:#4B5873">'
    + esc(c.foot) + '<br>' + esc(ADDRESS) + '</td></tr>'
    + '</table></td></tr></table></body></html>';
  const text = [c.head, '', ...c.body.flatMap((p) => [p, '']), 'Jeanette Ponder', c.title, '', c.foot, ADDRESS].join('\n');
  return { subject: c.subject, html, text };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.RESEND_API_KEY;
  if (req.method === 'GET') return res.status(200).json({ configured: Boolean(key) });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  if (!key) { console.error('newsletter: RESEND_API_KEY is not set for this deployment'); return res.status(503).json({ ok: false, error: 'not_configured' }); }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'invalid' });
  const lang = b.lang === 'es' ? 'es' : 'en';
  console.log('newsletter_request', lang);
  const m = build(lang);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [email], reply_to: REPLY_TO, subject: m.subject, html: m.html, text: m.text,
        headers: { 'List-Unsubscribe': '<mailto:' + REPLY_TO + '?subject=unsubscribe>' }
      })
    });
    if (!r.ok) { console.error('newsletter_resend_error', r.status, await r.text()); return res.status(502).json({ ok: false, error: 'upstream' }); }
    const sent = await r.json().catch(() => ({}));
    console.log('newsletter_sent', lang, 'resend_id=' + (sent.id || 'none'), 'domain=' + email.split('@')[1]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('newsletter_exception', e && e.message);
    return res.status(502).json({ ok: false, error: 'upstream' });
  }
};
