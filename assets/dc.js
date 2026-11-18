/* Small runtime for The Present Company pages.
   Runs each page's Component class (menus, tabs, form states) and sends
   form submissions to the Google Apps Script set in window.TPC_FORM_URL. */
(function () {
  var comp = null;
  var vals = {};

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function render() {
    vals = comp.renderVals() || {};
    document.querySelectorAll('[data-if]').forEach(function (el) {
      el.style.display = get(vals, el.getAttribute('data-if')) ? 'contents' : 'none';
    });
    document.querySelectorAll('*').forEach(function (el) {
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf('data-b-') !== 0) continue;
        var attr = a.name.slice(7), v = get(vals, a.value);
        if (v === undefined) continue;
        if (attr === 'class') el.className = v;
        else el.setAttribute(attr, String(v));
      }
    });
  }

  window.DCLogic = function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  };
  window.DCLogic.prototype.setState = function (patch) {
    Object.assign(this.state, patch);
    render();
  };

  function handler(el, attr) {
    var fn = get(vals, el.getAttribute(attr));
    return typeof fn === 'function' ? fn : null;
  }

  function send(form) {
    var url = window.TPC_FORM_URL;
    var fd = new FormData(form);
    var jobs = [fetch(url, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(fd) })];
    // Ponder waitlist sign-ups also go to the existing Notion waitlist (/api/waitlist),
    // which sends the confirmation email. Best effort: the sheet copy is the backup.
    if (form.getAttribute('data-form') === 'waitlist' && !fd.get('website')) {
      jobs.push(fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name') || '', email: fd.get('email') || '', quick: true,
          src: document.documentElement.lang === 'es' ? 'tpc-home-es' : 'tpc-home' })
      }).catch(function () {}));
    }
    // Newsletter sign-ups also trigger the welcome email (/api/newsletter). Best effort.
    if (form.getAttribute('data-form') === 'newsletter' && !fd.get('website')) {
      jobs.push(fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email') || '', lang: fd.get('lang') || document.documentElement.lang })
      }).catch(function () {}));
    }
    return Promise.all(jobs);
  }

  window.TPC = {
    mount: function (Component) {
      comp = new Component({});
      if (!comp.state) comp.state = {};
      render();

      document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-on-click]');
        if (!el) return;
        var fn = handler(el, 'data-on-click');
        if (fn) fn(e);
      });

      document.querySelectorAll('[data-on-mouseleave]').forEach(function (el) {
        el.addEventListener('mouseleave', function (e) {
          var fn = handler(el, 'data-on-mouseleave');
          if (fn) fn(e);
        });
      });

      document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form.hasAttribute('data-on-submit')) return;
        e.preventDefault();
        var fn = handler(form, 'data-on-submit');
        var button = form.querySelector('[type="submit"]');
        if (!form.hasAttribute('data-form')) { if (fn) fn(e); return; }
        if (button) { button.disabled = true; button.style.opacity = '.6'; }
        send(form).then(function () {
          if (fn) fn(e);
        }).catch(function () {
          if (button) { button.disabled = false; button.style.opacity = ''; }
          var es = document.documentElement.lang === 'es';
          alert(es
            ? 'No pudimos enviar el formulario. Revisa tu conexión o escríbenos a info@thepresentco.com.'
            : 'We couldn\'t send that. Check your connection, or write to us at info@thepresentco.com.');
        });
      });
    }
  };
})();
