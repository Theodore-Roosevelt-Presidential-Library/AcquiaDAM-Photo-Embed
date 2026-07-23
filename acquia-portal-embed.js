/*!
 * acquia-portal-embed.js
 * ------------------------------------------------------------------
 * Renders an Acquia DAM (Widen) press portal's galleries as NATIVE
 * content on your page — a responsive grid of gallery tiles that grows
 * to fit (no fixed-height iframe, no interior scrollbar). Clicking a
 * tile opens the real portal gallery in a lightbox (an embedded iframe
 * of that specific collection), so visitors browse and download without
 * leaving your site.
 *
 * How it gets the data
 *   The Acquia portal API blocks cross-origin browser requests, so the
 *   page can't read it directly. Instead a small scheduled job
 *   (scripts/generate-portal-data.js via GitHub Actions) writes a static
 *   JSON snapshot that is served from your own domain with CORS enabled.
 *   This script fetches that snapshot and renders the tiles.
 *
 * Usage (script-tag, auto-init):
 *   <script src="/acquia-portal-embed.js"
 *           data-data-url="https://portalphotos.labs.trlibrary.com/data/ob41lpui.json"></script>
 *
 * Usage (programmatic):
 *   AcquiaPortalEmbed.init({ dataUrl: '...', target: '#press' });
 * ------------------------------------------------------------------
 * MIT License. Theodore Roosevelt Presidential Library.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    dataUrl: '',            // URL of the JSON snapshot (required)
    target: '',             // CSS selector to render into (default: after the script tag)
    minTile: 260,           // px: minimum tile width; grid auto-fills columns
    gap: 18,                // px: grid gap
    radius: 12,             // px: tile/lightbox corner radius
    accent: '#1f5c3d',      // heading rule + count badge accent
    showSectionHeadings: true,
    showCounts: true,
    aspect: '3 / 2',        // tile image aspect ratio (CSS aspect-ratio value)
    lightbox: true,         // open galleries in a lightbox; false = new tab
    embedded: true,         // use Acquia's ?embedded=true mode in the lightbox
    title: 'Press gallery'
  };

  function toBool(v, f) {
    if (v === undefined || v === null || v === '') return f;
    if (typeof v === 'boolean') return v;
    return String(v).toLowerCase() !== 'false' && String(v) !== '0';
  }

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  function injectCss(opts) {
    if (document.getElementById('ape-css')) return;
    var s = document.createElement('style');
    s.id = 'ape-css';
    s.textContent = [
      '.ape{--ape-accent:' + opts.accent + ';--ape-radius:' + opts.radius + 'px;--ape-gap:' + opts.gap + 'px;width:100%;}',
      '.ape-section{margin:0 0 32px;}',
      '.ape-h{font-size:1.25rem;font-weight:700;letter-spacing:.01em;margin:0 0 14px;padding-bottom:8px;' +
        'border-bottom:2px solid var(--ape-accent);display:inline-block;}',
      '.ape-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(' + opts.minTile + 'px,1fr));gap:var(--ape-gap);}',
      '.ape-tile{position:relative;display:block;border:0;padding:0;text-align:left;cursor:pointer;background:#eceeed;' +
        'border-radius:var(--ape-radius);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.10);' +
        'transition:transform .18s ease, box-shadow .18s ease;color:inherit;text-decoration:none;font:inherit;}',
      '.ape-tile:hover,.ape-tile:focus-visible{transform:translateY(-3px);box-shadow:0 8px 22px rgba(0,0,0,.18);outline:none;}',
      '.ape-tile:focus-visible{box-shadow:0 0 0 3px var(--ape-accent);}',
      '.ape-thumb{display:block;width:100%;aspect-ratio:' + opts.aspect + ';object-fit:cover;background:#dfe3e1;}',
      '.ape-meta{padding:11px 13px 13px;}',
      '.ape-title{font-size:.95rem;font-weight:650;line-height:1.3;margin:0;color:#1c2b24;}',
      '.ape-count{display:inline-block;margin-top:6px;font-size:.75rem;font-weight:600;color:#fff;' +
        'background:var(--ape-accent);border-radius:20px;padding:2px 9px;}',
      '.ape-badge{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.6);color:#fff;font-size:.72rem;' +
        'font-weight:600;padding:3px 9px;border-radius:20px;backdrop-filter:blur(2px);}',
      '.ape-msg{padding:16px;border:1px dashed #c3ccc8;border-radius:8px;color:#4b5b53;font-size:.9rem;}',
      '.ape-skel{border-radius:var(--ape-radius);overflow:hidden;background:#eceeed;}',
      '.ape-skel .ape-thumb{animation:ape-pulse 1.3s ease-in-out infinite;}',
      '@keyframes ape-pulse{0%,100%{opacity:1}50%{opacity:.55}}',
      /* Lightbox */
      '.ape-lb{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
        'padding:min(4vw,40px);background:rgba(15,20,17,.72);opacity:0;transition:opacity .2s ease;}',
      '.ape-lb.ape-open{opacity:1;}',
      '.ape-panel{position:relative;width:100%;max-width:1200px;height:100%;max-height:900px;display:flex;flex-direction:column;' +
        'background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45);}',
      '.ape-bar{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #e6e9e7;background:#fafbfb;}',
      '.ape-bar h3{margin:0;font-size:1rem;font-weight:700;color:#1c2b24;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ape-open-new{font-size:.82rem;color:var(--ape-accent);text-decoration:none;font-weight:600;white-space:nowrap;}',
      '.ape-open-new:hover{text-decoration:underline;}',
      '.ape-x{appearance:none;border:0;background:#eef1f0;width:34px;height:34px;border-radius:8px;cursor:pointer;' +
        'font-size:20px;line-height:1;color:#333;display:flex;align-items:center;justify-content:center;}',
      '.ape-x:hover{background:#e2e6e4;}',
      '.ape-lb iframe{flex:1;width:100%;border:0;background:#fff;}',
      'html.ape-lock,body.ape-lock{overflow:hidden;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* --------------------- Deep-link to a gallery --------------------- */
  // Acquia routes an interior gallery by PATH, not by hash:
  //   {portalUrl}/c/{collectionId}/s/{sectionId}
  function galleryUrl(portal, gallery, sectionId, embedded) {
    var base = String(portal.url || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
    var url = base + '/c/' + gallery.id + (sectionId ? '/s/' + sectionId : '');
    if (embedded) url += '?embedded=true';
    return url;
  }

  /* ---------------------------- Lightbox ---------------------------- */
  var activeLb = null;

  function closeLightbox() {
    if (!activeLb) return;
    var lb = activeLb; activeLb = null;
    lb.overlay.classList.remove('ape-open');
    document.documentElement.classList.remove('ape-lock');
    document.body.classList.remove('ape-lock');
    document.removeEventListener('keydown', lb.onKey, true);
    setTimeout(function () { if (lb.overlay.parentNode) lb.overlay.parentNode.removeChild(lb.overlay); }, 200);
    if (lb.restoreFocus && lb.restoreFocus.focus) { try { lb.restoreFocus.focus(); } catch (e) {} }
  }

  function openLightbox(portal, gallery, sectionId, opts, sourceEl) {
    closeLightbox();
    var src = galleryUrl(portal, gallery, sectionId, toBool(opts.embedded, true));
    var newTabUrl = galleryUrl(portal, gallery, sectionId, false);

    var overlay = el('div', 'ape-lb', { role: 'dialog', 'aria-modal': 'true', 'aria-label': gallery.title });
    var panel = el('div', 'ape-panel');
    var bar = el('div', 'ape-bar');
    var h = el('h3'); h.textContent = gallery.title;
    var openNew = el('a', 'ape-open-new', { href: newTabUrl, target: '_blank', rel: 'noopener' });
    openNew.textContent = 'Open in new tab ↗';
    var x = el('button', 'ape-x', { type: 'button', 'aria-label': 'Close gallery' });
    x.innerHTML = '&times;';
    var frame = el('iframe', null, {
      src: src, title: gallery.title, allow: 'fullscreen; clipboard-write', allowfullscreen: ''
    });

    bar.appendChild(h); bar.appendChild(openNew); bar.appendChild(x);
    panel.appendChild(bar); panel.appendChild(frame);
    overlay.appendChild(panel);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeLightbox(); });
    x.addEventListener('click', closeLightbox);
    var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeLightbox(); } };

    document.body.appendChild(overlay);
    document.documentElement.classList.add('ape-lock');
    document.body.classList.add('ape-lock');
    document.addEventListener('keydown', onKey, true);
    // Force reflow then fade in.
    void overlay.offsetWidth;
    overlay.classList.add('ape-open');
    setTimeout(function () { try { x.focus(); } catch (e) {} }, 30);

    activeLb = { overlay: overlay, onKey: onKey, restoreFocus: sourceEl };
  }

  /* ---------------------------- Rendering ---------------------------- */
  function buildTile(portal, gallery, sectionId, opts) {
    var lightbox = toBool(opts.lightbox, true);
    var deep = galleryUrl(portal, gallery, sectionId, false);

    var tile = lightbox
      ? el('button', 'ape-tile', { type: 'button' })
      : el('a', 'ape-tile', { href: deep, target: '_blank', rel: 'noopener' });

    if (gallery.thumb) {
      var img = el('img', 'ape-thumb', {
        src: gallery.thumb, alt: gallery.title, loading: 'lazy', decoding: 'async'
      });
      if (gallery.thumb2x) img.setAttribute('srcset', gallery.thumb + ' 1x, ' + gallery.thumb2x + ' 2x');
      img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
      tile.appendChild(img);
    } else {
      tile.appendChild(el('div', 'ape-thumb'));
    }

    if (toBool(opts.showCounts, true) && gallery.count) {
      var badge = el('div', 'ape-badge');
      badge.textContent = gallery.count.toLocaleString() + ' photos';
      tile.appendChild(badge);
    }

    var meta = el('div', 'ape-meta');
    var title = el('p', 'ape-title'); title.textContent = gallery.title;
    meta.appendChild(title);
    tile.appendChild(meta);

    if (lightbox) {
      tile.addEventListener('click', function () { openLightbox(portal, gallery, sectionId, opts, tile); });
    }
    return tile;
  }

  function render(root, data, opts) {
    root.innerHTML = '';
    var portal = data.portal || {};
    (data.sections || []).forEach(function (sec) {
      if (!sec.galleries || !sec.galleries.length) return;
      var wrap = el('div', 'ape-section');
      if (toBool(opts.showSectionHeadings, true) && sec.name) {
        var h = el('h2', 'ape-h'); h.textContent = sec.name;
        wrap.appendChild(h);
      }
      var grid = el('div', 'ape-grid');
      sec.galleries.forEach(function (g) { grid.appendChild(buildTile(portal, g, sec.id, opts)); });
      wrap.appendChild(grid);
      root.appendChild(wrap);
    });
    if (!root.childNodes.length) {
      var msg = el('div', 'ape-msg');
      msg.textContent = 'No galleries are available right now.';
      root.appendChild(msg);
    }
  }

  function renderSkeleton(root, opts) {
    root.innerHTML = '';
    var grid = el('div', 'ape-grid');
    for (var i = 0; i < 6; i++) {
      var t = el('div', 'ape-tile ape-skel');
      t.appendChild(el('div', 'ape-thumb'));
      var m = el('div', 'ape-meta'); m.appendChild(el('p', 'ape-title'));
      t.appendChild(m); grid.appendChild(t);
    }
    root.appendChild(grid);
  }

  /* ------------------------------ Init ------------------------------ */
  function init(userOpts, scriptEl) {
    var opts = {}, k;
    for (k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) opts[k] = DEFAULTS[k];
    for (k in userOpts) if (userOpts.hasOwnProperty(k) && userOpts[k] !== undefined && userOpts[k] !== '') opts[k] = userOpts[k];

    if (!opts.dataUrl) throw new Error('[acquia-portal-embed] "dataUrl" is required.');
    injectCss(opts);

    var root = el('div', 'ape');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', opts.title || 'Press galleries');

    var container = opts.target ? document.querySelector(opts.target) : null;
    if (container) container.appendChild(root);
    else if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.insertBefore(root, scriptEl.nextSibling);
    else document.body.appendChild(root);

    renderSkeleton(root, opts);

    fetch(opts.dataUrl, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) { render(root, data, opts); })
      .catch(function (err) {
        root.innerHTML = '';
        var msg = el('div', 'ape-msg');
        msg.textContent = 'The press galleries could not be loaded right now.';
        root.appendChild(msg);
        if (global.console) console.error('[acquia-portal-embed]', err);
      });

    return { root: root };
  }

  function optsFromScript(elm) {
    var d = elm.dataset || {};
    return {
      dataUrl: d.dataUrl,
      target: d.target,
      minTile: d.minTile ? parseInt(d.minTile, 10) : undefined,
      gap: d.gap ? parseInt(d.gap, 10) : undefined,
      radius: d.radius ? parseInt(d.radius, 10) : undefined,
      accent: d.accent,
      showSectionHeadings: d.showSectionHeadings,
      showCounts: d.showCounts,
      aspect: d.aspect,
      lightbox: d.lightbox,
      embedded: d.embedded,
      title: d.title
    };
  }

  function autoInit() {
    var elm = document.currentScript;
    if (!elm) return;
    var d = elm.dataset || {};
    if (!d.dataUrl) return; // included as a library; use AcquiaPortalEmbed.init()
    try { init(optsFromScript(elm), elm); }
    catch (e) { if (global.console) console.error(e); }
  }

  global.AcquiaPortalEmbed = { init: init, closeLightbox: closeLightbox, DEFAULTS: DEFAULTS };
  autoInit();
})(window);
