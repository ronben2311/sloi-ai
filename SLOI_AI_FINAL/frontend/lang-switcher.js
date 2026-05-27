/* lang-switcher.js — SLOI AI global language picker
   Injects a globe icon + dropdown into every page's <nav>.
   Uses Google Translate for actual page translation.
   Supports: EN · AR · RU · ES · HE (RTL handled for AR + HE). */

(function () {
  'use strict';

  var LANGS = [
    { code: 'en', label: 'English',   rtl: false },
    { code: 'ar', label: 'العربية',   rtl: true  },
    { code: 'ru', label: 'Русский',   rtl: false },
    { code: 'es', label: 'Español',   rtl: false },
    { code: 'he', label: 'עברית',     rtl: true  }
  ];

  var current = localStorage.getItem('sloi_lang') || 'en';

  function getLang(code) {
    return LANGS.find(function (l) { return l.code === code; }) || LANGS[0];
  }

  /* ── Styles ───────────────────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('ls-style')) return;
    var s = document.createElement('style');
    s.id = 'ls-style';
    s.textContent =
      /* wrapper */
      '.ls-wrap{position:relative;flex-shrink:0;display:flex;align-items:center;margin-left:8px}' +

      /* trigger button */
      '.ls-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:5px;' +
        'border:1px solid #22223a;background:none;cursor:pointer;color:#52526e;' +
        'font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:500;' +
        'transition:all .15s;white-space:nowrap;outline:none;line-height:1}' +
      '.ls-btn:hover{border-color:rgba(91,95,239,.5);color:#8b8ff8}' +
      '.ls-btn svg{width:14px;height:14px;fill:currentColor;flex-shrink:0}' +
      '.ls-code{letter-spacing:.06em;font-size:10px}' +

      /* dropdown */
      '.ls-dd{position:absolute;top:calc(100% + 8px);right:0;background:#0d0d1a;' +
        'border:1px solid #1a1a2e;border-radius:8px;min-width:158px;' +
        'box-shadow:0 20px 56px rgba(0,0,0,.65);z-index:1100;overflow:hidden;display:none}' +
      '.ls-dd.open{display:block;animation:lsFadeIn .14s ease}' +
      '@keyframes lsFadeIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}' +
      '.ls-hdr{padding:8px 16px 7px;font-family:"IBM Plex Mono",monospace;font-size:9px;' +
        'color:#4e4e6a;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid #1a1a2e}' +
      '.ls-item{display:flex;align-items:center;justify-content:space-between;' +
        'padding:10px 16px;cursor:pointer;font-family:"IBM Plex Mono",monospace;' +
        'font-size:12px;color:#cac8e4;transition:background .1s;gap:10px}' +
      '.ls-item:hover{background:rgba(91,95,239,.1)}' +
      '.ls-item.active{color:#5b5fef}' +
      '.ls-check{color:#5b5fef;font-size:10px;opacity:0;flex-shrink:0}' +
      '.ls-item.active .ls-check{opacity:1}' +

      /* hide Google Translate chrome */
      '.goog-te-banner-frame{display:none!important}' +
      'body{top:0!important}' +
      '#google_translate_element{position:absolute;left:-9999px;pointer-events:none;opacity:0}' +
      '.skiptranslate > iframe{display:none!important}';

    document.head.appendChild(s);
  }

  /* ── Build UI ─────────────────────────────────────────────────────────────── */
  function buildUI() {
    if (document.querySelector('.ls-wrap')) return;
    var nav = document.querySelector('nav');
    if (!nav) return;

    var wrap = document.createElement('div');
    wrap.className = 'ls-wrap';

    /* globe SVG + language code */
    var btn = document.createElement('button');
    btn.className = 'ls-btn';
    btn.setAttribute('aria-label', 'Select language');
    btn.setAttribute('title', 'Language');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' +
          'm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z' +
          'm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7' +
          'h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>' +
      '</svg>' +
      '<span class="ls-code">' + current.toUpperCase() + '</span>';

    /* dropdown */
    var dd = document.createElement('div');
    dd.className = 'ls-dd';
    dd.innerHTML = '<div class="ls-hdr">Language</div>';

    LANGS.forEach(function (l) {
      var item = document.createElement('div');
      item.className = 'ls-item' + (l.code === current ? ' active' : '');
      item.setAttribute('data-lang', l.code);
      item.innerHTML = '<span>' + l.label + '</span><span class="ls-check">✓</span>';
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        selectLang(l.code);
      });
      dd.appendChild(item);
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      dd.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      dd.classList.remove('open');
    });

    wrap.appendChild(btn);
    wrap.appendChild(dd);

    /* inject: prefer .nav-right, fall back to appending to nav */
    var navRight = nav.querySelector('.nav-right');
    if (navRight) {
      navRight.insertBefore(wrap, navRight.firstChild);
    } else {
      wrap.style.marginLeft = 'auto';
      nav.appendChild(wrap);
    }
  }

  /* ── Language selection ───────────────────────────────────────────────────── */
  function selectLang(code) {
    current = code;
    localStorage.setItem('sloi_lang', code);

    /* RTL toggle */
    var lang = getLang(code);
    document.documentElement.setAttribute('dir', lang.rtl ? 'rtl' : 'ltr');

    /* try live Google Translate widget first */
    var sel = document.querySelector('.goog-te-combo');
    if (sel) {
      sel.value = code === 'en' ? '' : code;
      sel.dispatchEvent(new Event('change'));
      updateBtn(code);
      return;
    }

    /* fall back: set googtrans cookie + reload */
    var val = code === 'en' ? '/en/en' : '/en/' + code;
    document.cookie = 'googtrans=' + val + '; path=/; domain=' + window.location.hostname;
    document.cookie = 'googtrans=' + val + '; path=/';
    window.location.reload();
  }

  function updateBtn(code) {
    var span = document.querySelector('.ls-btn .ls-code');
    if (span) span.textContent = code.toUpperCase();
    document.querySelectorAll('.ls-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-lang') === code);
    });
    var dd = document.querySelector('.ls-dd');
    if (dd) dd.classList.remove('open');
  }

  /* ── Google Translate init ────────────────────────────────────────────────── */
  function initGT() {
    if (!document.getElementById('google_translate_element')) {
      var el = document.createElement('div');
      el.id = 'google_translate_element';
      document.body.appendChild(el);
    }

    window.googleTranslateElementInit = function () {
      /* global google */
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'ar,en,es,he,ru',
        autoDisplay: false
      }, 'google_translate_element');

      /* apply stored language once widget is ready */
      if (current !== 'en') {
        var attempts = 0;
        var timer = setInterval(function () {
          var sel = document.querySelector('.goog-te-combo');
          if (sel) {
            clearInterval(timer);
            if (sel.value !== current) {
              sel.value = current;
              sel.dispatchEvent(new Event('change'));
            }
          } else if (++attempts > 30) {
            clearInterval(timer);
          }
        }, 200);
      }
    };

    if (!document.querySelector('script[src*="translate.google.com"]')) {
      var sc = document.createElement('script');
      sc.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      sc.async = true;
      document.head.appendChild(sc);
    }
  }

  /* ── Bootstrap ────────────────────────────────────────────────────────────── */
  function init() {
    injectStyles();
    var lang = getLang(current);
    if (lang.rtl) document.documentElement.setAttribute('dir', 'rtl');
    buildUI();
    initGT();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
