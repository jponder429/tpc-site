/* Newsletter pop-up for thepresentco.com (EN/ES).
   A slide-in card, not a full-screen takeover: it appears after 20 seconds or
   once the visitor scrolls 55% of the page, whichever comes first. It stays away
   for 30 days after a close, forever after a sign-up (here or in the footer
   form), and never shows while the newsletter section is on screen.
   Sign-ups post to the same Google Apps Script as the page's newsletter form. */
(function () {
  var KEY = 'tpc_news_popup_v1', DAYS = 30;
  var es = (document.documentElement.lang || '').slice(0, 2) === 'es';
  var T = es ? {
    lab: 'Boletín', h: 'IA y gobernanza, en lenguaje claro.',
    p: 'Nuevas reglas, casos reales y notas prácticas para quienes usan IA en el trabajo.',
    email: 'Correo electrónico', btn: 'Suscribirme', fine: 'Puedes darte de baja cuando quieras. Nunca compartimos tu correo.',
    close: 'Cerrar', done: '¡Gracias! Revisa tu correo: te enviamos un mensaje de confirmación desde hello@thepresentco.com. Si no llega, revisa tu carpeta de correo no deseado o spam.', err: 'No pudimos enviarlo. Inténtalo de nuevo.'
  } : {
    lab: 'Newsletter', h: 'AI governance, in plain language.',
    p: 'New rules, real cases and practical notes for people who use AI at work.',
    email: 'Email', btn: 'Subscribe', fine: 'Unsubscribe anytime. We never share your address.',
    close: 'Close', done: 'Thank you! Please check your email for a confirmation message from hello@thepresentco.com. If it doesn’t arrive, please check your junk or spam folders.', err: 'We couldn’t send that. Please try again.'
  };

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  var st = read();
  if (st.subscribed) return;
  if (st.closed && Date.now() - st.closed < DAYS * 864e5) return;
  if (!window.TPC_FORM_URL) return;

  // A sign-up in the page's own newsletter form also counts.
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.getAttribute && e.target.getAttribute('data-form') === 'newsletter') write({ subscribed: true });
  }, true);

  var css = '.tpc-np{position:fixed;right:24px;bottom:24px;z-index:1000;width:min(420px,calc(100vw - 32px));background:#F8F5EF;color:#0C1D38;border:1px solid #0C1D38;font-family:"Instrument Sans",Arial,sans-serif;box-shadow:0 18px 40px rgba(12,29,56,.28);transform:translateY(24px);opacity:0;transition:transform .35s ease,opacity .35s ease}'
    + '.tpc-np.in{transform:none;opacity:1}'
    + '.tpc-np-bar{display:flex;height:8px}.tpc-np-bar i{display:block}'
    + '.tpc-np-in{padding:24px 24px 22px;display:flex;flex-direction:column;gap:12px}'
    + '.tpc-np-lab{font-family:"DM Mono",monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7F6120}'
    + '.tpc-np h2{margin:0;font-family:"Instrument Sans",Arial,sans-serif;font-weight:600;font-size:28px;line-height:1.08;letter-spacing:-.03em;padding-right:36px}'
    + '.tpc-np p{margin:0;font-size:16px;line-height:1.5;color:#4B5873}'
    + '.tpc-np form{display:flex;flex-direction:column;gap:8px;margin-top:4px}'
    + '.tpc-np label{font-size:14px;font-weight:500}'
    + '.tpc-np .row{display:flex;gap:8px;flex-wrap:wrap}'
    + '.tpc-np input[type=email]{flex:1 1 180px;min-height:50px;border:1px solid #0C1D38;border-radius:0;padding:0 14px;font:inherit;font-size:16px;background:#fff;color:#0C1D38}'
    + '.tpc-np input[type=email]:focus{outline:2px solid #C9A657;outline-offset:1px}'
    + '.tpc-np button[type=submit]{flex:0 0 auto;min-height:50px;padding:0 22px;border:0;border-radius:0;background:#0C1D38;color:#F8F5EF;font:inherit;font-weight:600;font-size:16px;cursor:pointer}'
    + '.tpc-np button[type=submit]:hover{background:#13264A}'
    + '.tpc-np .fine{font-size:13px;color:#4B5873}'
    + '.tpc-np-x{position:absolute;top:18px;right:14px;width:44px;height:44px;border:0;background:transparent;color:#0C1D38;font-size:26px;line-height:1;cursor:pointer}'
    + '.tpc-np-x:focus-visible,.tpc-np button[type=submit]:focus-visible{outline:2px solid #C9A657;outline-offset:2px}'
    + '.tpc-np .done{font-size:20px;font-weight:600;line-height:1.3;color:#0C1D38;border-top:2px solid #C9A657;padding-top:14px}'
    + '@media(max-width:600px){.tpc-np{right:0;left:0;bottom:0;width:auto;border-left:0;border-right:0;border-bottom:0}.tpc-np h2{font-size:26px}}'
    + '@media(prefers-reduced-motion:reduce){.tpc-np{transition:none}}';

  var shown = false, box, lastFocus;
  function inView(id) {
    var el = document.getElementById(id); if (!el) return false;
    var r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0;
  }
  function close() {
    if (!box) return;
    write({ closed: Date.now() });
    box.classList.remove('in');
    setTimeout(function () { box && box.remove(); }, 400);
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function show() {
    if (shown || inView('newsletter')) return;
    shown = true; cleanup();
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    var stripes = [['#13264A', 3], ['#091629', 1], ['#5A8EC4', 1], ['#13264A', 3], ['#2E4D3C', 2], ['#0C1D38', 3], ['#8A5A86', 1], ['#C9A657', 1], ['#13264A', 2]]
      .map(function (c) { return '<i style="flex:' + c[1] + ';background:' + c[0] + '"></i>'; }).join('');
    box = document.createElement('div');
    box.className = 'tpc-np'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'false'); box.setAttribute('aria-labelledby', 'tpc-np-h');
    box.innerHTML = '<div class="tpc-np-bar" aria-hidden="true">' + stripes + '</div>'
      + '<button type="button" class="tpc-np-x" aria-label="' + T.close + '">×</button>'
      + '<div class="tpc-np-in"><span class="tpc-np-lab">' + T.lab + '</span><h2 id="tpc-np-h">' + T.h + '</h2><p>' + T.p + '</p>'
      + '<form novalidate><input type="hidden" name="form" value="newsletter"><input type="hidden" name="lang" value="' + (es ? 'es' : 'en') + '">'
      + '<div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'
      + '<label for="tpc-np-email">' + T.email + '</label><div class="row"><input id="tpc-np-email" type="email" name="email" autocomplete="email" required><button type="submit">' + T.btn + '</button></div>'
      + '<span class="fine">' + T.fine + '</span></form></div>';
    document.body.appendChild(box);
    box.querySelector('.tpc-np-x').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    var form = box.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type=email]');
      if (!input.checkValidity()) { input.reportValidity(); return; }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.style.opacity = '.6';
      var fd = new FormData(form);
      if (fd.get('website')) return; // bot
      fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email') || '', lang: es ? 'es' : 'en' }) }).catch(function () {});
      fetch(window.TPC_FORM_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(fd) }).then(function () {
        write({ subscribed: true });
        form.outerHTML = '<div class="done" role="status">' + T.done + '</div>';
        setTimeout(function () { if (box) { box.classList.remove('in'); setTimeout(function () { box && box.remove(); }, 400); } }, 8000);
      }).catch(function () {
        btn.disabled = false; btn.style.opacity = ''; alert(T.err);
      });
    });
    lastFocus = document.activeElement;
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('in'); }); });
  }

  var timer = setTimeout(show, 20000);
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0 && scrollY / h >= 0.55) show();
  }
  function cleanup() { clearTimeout(timer); removeEventListener('scroll', onScroll); }
  addEventListener('scroll', onScroll, { passive: true });
  window.TPCNewsPopup = { show: show }; // for testing
})();
