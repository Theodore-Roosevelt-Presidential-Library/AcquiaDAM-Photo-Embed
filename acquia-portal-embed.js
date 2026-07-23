/*!
 * acquia-portal-embed.js
 * ------------------------------------------------------------------
 * A lightweight, dependency-free embed for Acquia DAM (Widen) portals.
 *
 * It drops a responsive, self-sizing iframe of any Acquia DAM portal
 * onto your page. Galleries open natively inside the frame, so visitors
 * browse and download press assets without leaving your site.
 *
 * Why an iframe (and not a JS API embed)?
 *   The Acquia portal JSON API does not send CORS headers, so a page on
 *   your own domain cannot fetch portal data directly in the browser.
 *   The portal itself, however, renders fine inside a cross-origin
 *   iframe. This embed leans on that: zero backend, zero API keys, and
 *   it always shows live, up-to-date galleries.
 *
 * Height note:
 *   Acquia portals do not post their content height to the parent page,
 *   so a cross-origin frame cannot auto-fit to the exact pixel height of
 *   its content. Instead this embed sizes the frame responsively to the
 *   viewport (with sensible min/max bounds) so the gallery grid shows
 *   generously and the portal handles its own internal scrolling — no
 *   more cramped fixed-height box.
 *
 * Two ways to use it:
 *   1) Auto-init from the script tag's data-* attributes (see README).
 *   2) Programmatic:  AcquiaPortalEmbed.init({ portalUrl: '...' , ... })
 * ------------------------------------------------------------------
 * MIT License. Theodore Roosevelt Presidential Library.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    // Either provide a full portalUrl, OR domain + shortcode (+ path).
    portalUrl: '',            // e.g. 'https://trlibrary.acquiadam.com/portals/ob41lpui/PressPortal'
    domain: '',               // e.g. 'trlibrary.acquiadam.com'
    shortcode: '',            // e.g. 'ob41lpui'
    path: 'Portal',           // the portal's URL name segment, e.g. 'PressPortal'

    embedded: true,           // append ?embedded=true (Acquia's chrome-light mode)
    collection: '',           // optional collection id to deep-link a specific gallery on load

    // Sizing. height accepts:
    //   'responsive' (default) -> fills the viewport within the bounds below
    //   a number or '1200px'   -> fixed pixel height
    //   '90vh'                 -> any valid CSS length
    height: 'responsive',
    minHeight: 680,           // px, only used in 'responsive' mode
    maxHeight: 1500,          // px, only used in 'responsive' mode
    viewportRatio: 0.9,       // fraction of window height used in 'responsive' mode

    // Appearance
    borderRadius: '10px',
    shadow: true,
    background: '#ffffff',

    target: '',               // optional CSS selector to render into; defaults to inline placement
    title: 'Press portal gallery'
  };

  function toBool(v, fallback) {
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v === 'boolean') return v;
    return String(v).toLowerCase() !== 'false' && String(v) !== '0';
  }

  function buildPortalUrl(opts) {
    var base = opts.portalUrl && opts.portalUrl.trim();
    if (!base) {
      if (!opts.domain || !opts.shortcode) {
        throw new Error('[acquia-portal-embed] Provide either "portalUrl" or both "domain" and "shortcode".');
      }
      var domain = String(opts.domain).replace(/^https?:\/\//, '').replace(/\/+$/, '');
      var path = String(opts.path || 'Portal').replace(/\s+/g, '');
      base = 'https://' + domain + '/portals/' + opts.shortcode + '/' + path;
    }
    // Strip any existing hash so we can control the deep-link cleanly.
    base = base.split('#')[0];

    // embedded=true query param (Acquia's lighter embed presentation)
    if (toBool(opts.embedded, true)) {
      base += (base.indexOf('?') === -1 ? '?' : '&') + 'embedded=true';
    }
    // Optional deep-link straight into a specific gallery/collection.
    if (opts.collection) {
      base += '#' + String(opts.collection).replace(/^#/, '');
    }
    return base;
  }

  function computeResponsiveHeight(opts) {
    var min = parseInt(opts.minHeight, 10) || 680;
    var max = parseInt(opts.maxHeight, 10) || 1500;
    var ratio = parseFloat(opts.viewportRatio) || 0.9;
    var vh = (global.innerHeight || 900);
    var h = Math.round(vh * ratio);
    return Math.max(min, Math.min(max, h));
  }

  function applyHeight(iframe, opts) {
    var h = opts.height;
    if (h === undefined || h === null || h === '' || h === 'responsive') {
      var px = computeResponsiveHeight(opts);
      iframe.style.height = px + 'px';
      return true; // responsive -> caller should attach resize handler
    }
    // Numeric -> px; string with unit -> used as-is.
    if (typeof h === 'number' || /^\d+$/.test(String(h))) {
      iframe.style.height = parseInt(h, 10) + 'px';
    } else {
      iframe.style.height = String(h);
    }
    return false;
  }

  function makeSpinnerCss() {
    if (document.getElementById('acquia-portal-embed-css')) return;
    var style = document.createElement('style');
    style.id = 'acquia-portal-embed-css';
    style.textContent =
      '.ape-wrap{position:relative;width:100%;}' +
      '.ape-frame{display:block;width:100%;border:0;}' +
      '.ape-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'pointer-events:none;transition:opacity .4s ease;}' +
      '.ape-loading[hidden]{opacity:0;}' +
      '.ape-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(0,0,0,.15);' +
      'border-top-color:rgba(0,0,0,.55);animation:ape-spin .8s linear infinite;}' +
      '@keyframes ape-spin{to{transform:rotate(360deg);}}';
    document.head.appendChild(style);
  }

  function init(userOpts, scriptEl) {
    var opts = {};
    var k;
    for (k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) opts[k] = DEFAULTS[k];
    for (k in userOpts) if (userOpts.hasOwnProperty(k) && userOpts[k] !== undefined && userOpts[k] !== '') opts[k] = userOpts[k];

    var src = buildPortalUrl(opts);
    makeSpinnerCss();

    // Wrapper
    var wrap = document.createElement('div');
    wrap.className = 'ape-wrap';
    wrap.style.borderRadius = opts.borderRadius || '0';
    wrap.style.overflow = 'hidden';
    wrap.style.background = opts.background || '#fff';
    if (toBool(opts.shadow, true)) wrap.style.boxShadow = '0 2px 18px rgba(0,0,0,.10)';

    // Iframe
    var iframe = document.createElement('iframe');
    iframe.className = 'ape-frame';
    iframe.src = src;
    iframe.title = opts.title || 'Press portal gallery';
    iframe.loading = 'lazy';
    iframe.setAttribute('allow', 'fullscreen; clipboard-write');
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.background = opts.background || '#fff';

    var responsive = applyHeight(iframe, opts);

    // Loading indicator
    var loading = document.createElement('div');
    loading.className = 'ape-loading';
    loading.innerHTML = '<div class="ape-spinner" role="status" aria-label="Loading gallery"></div>';
    iframe.addEventListener('load', function () { loading.hidden = true; });
    // Safety: hide the spinner after a few seconds even if load doesn't fire.
    setTimeout(function () { loading.hidden = true; }, 6000);

    wrap.appendChild(iframe);
    wrap.appendChild(loading);

    // Placement
    var container = null;
    if (opts.target) container = document.querySelector(opts.target);
    if (container) {
      container.appendChild(wrap);
    } else if (scriptEl && scriptEl.parentNode) {
      scriptEl.parentNode.insertBefore(wrap, scriptEl.nextSibling);
    } else {
      document.body.appendChild(wrap);
    }

    // Keep responsive height in sync with the viewport.
    if (responsive) {
      var raf;
      var onResize = function () {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          iframe.style.height = computeResponsiveHeight(opts) + 'px';
        });
      };
      global.addEventListener('resize', onResize, { passive: true });
    }

    return { wrapper: wrap, iframe: iframe, src: src };
  }

  // Read config from a <script data-*> tag.
  function optsFromScript(el) {
    var d = el.dataset || {};
    return {
      portalUrl: d.portalUrl,
      domain: d.domain,
      shortcode: d.shortcode,
      path: d.path,
      embedded: d.embedded,
      collection: d.collection,
      height: d.height,
      minHeight: d.minHeight,
      maxHeight: d.maxHeight,
      viewportRatio: d.viewportRatio,
      borderRadius: d.borderRadius,
      shadow: d.shadow,
      background: d.background,
      target: d.target,
      title: d.title
    };
  }

  // Auto-init: if the currently executing script tag carries config, run it.
  function autoInit() {
    var el = document.currentScript;
    if (!el) return;
    var d = el.dataset || {};
    var hasConfig = d.portalUrl || d.shortcode || d.domain;
    if (!hasConfig) return; // library included without inline config; use AcquiaPortalEmbed.init()
    try {
      init(optsFromScript(el), el);
    } catch (e) {
      if (global.console) console.error(e);
    }
  }

  global.AcquiaPortalEmbed = { init: init, DEFAULTS: DEFAULTS };
  autoInit();
})(window);
