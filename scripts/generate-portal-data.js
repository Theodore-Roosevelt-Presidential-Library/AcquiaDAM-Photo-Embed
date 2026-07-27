#!/usr/bin/env node
/*
 * generate-portal-data.js
 * ------------------------------------------------------------------
 * Fetches public gallery data from one or more Acquia DAM (Widen)
 * portals and writes a static JSON snapshot per portal into ./data/.
 *
 * It also CACHES each gallery's preview thumbnail. Acquia returns
 * pre-signed thumbnail URLs that expire within ~1-2 hours, so hot-
 * linking them makes images load inconsistently (they 403 once the
 * signature lapses). Instead we download each thumbnail while the URL
 * is valid, store it under ./data/thumbs/<shortcode>/, and record a
 * RELATIVE path in the snapshot. Served from your own GitHub Pages
 * origin, those images are permanent, fast, and never expire.
 *
 * Why a snapshot at all?
 *   The Acquia portal JSON API sends no CORS headers, so a browser on
 *   your website can't read it directly. This script runs server-side
 *   (locally or in GitHub Actions), where CORS doesn't apply.
 *
 * Usage:  node scripts/generate-portal-data.js [config.json]
 * Env:    FORCE_THUMBS=1  re-download thumbnails even if already cached
 * Node 18+ (uses global fetch).
 * ------------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.resolve(ROOT, process.argv[2] || 'config.json');
const OUT_DIR = path.resolve(ROOT, 'data');
const THUMB_DIR = path.resolve(OUT_DIR, 'thumbs');
const FORCE = process.env.FORCE_THUMBS === '1';

// Cache the 600px preview: crisp enough for retina on ~264px tiles,
// while staying light. Fallbacks in case a size is missing.
const THUMB_SIZES = ['600px', '300px', '1080px', '160px', '125px'];

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function pickThumb(thumbnails) {
  if (!thumbnails) return null;
  for (const k of THUMB_SIZES) if (thumbnails[k]) return thumbnails[k];
  const keys = Object.keys(thumbnails);
  return keys.length ? thumbnails[keys[0]] : null;
}

function previewThumbUrl(asset) {
  if (!asset) return null;
  const t =
    (asset.image_previews && asset.image_previews.thumbnails) ||
    (asset.spinset_properties && asset.spinset_properties.thumbnails) ||
    null;
  return pickThumb(t);
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
}

// Stable key from the URL path (minus the signature query string), so the
// same asset+size always maps to the same file — no churn across runs.
function thumbKey(url) {
  return crypto.createHash('sha1').update(url.split('?')[0]).digest('hex').slice(0, 16);
}

function existingCached(shortcode, key) {
  for (const ext of ['.jpg', '.png', '.webp', '.gif']) {
    const rel = path.join('thumbs', shortcode, key + ext);
    if (fs.existsSync(path.join(OUT_DIR, rel))) return rel.split(path.sep).join('/');
  }
  return null;
}

// Downloads a thumbnail into ./data/thumbs/<shortcode>/ and returns its
// path relative to the data directory (e.g. "thumbs/ob41lpui/ab12.jpg").
// Returns null on failure. Skips the download if already cached.
async function cacheThumb(signedUrl, shortcode) {
  if (!signedUrl) return null;
  const key = thumbKey(signedUrl);

  if (!FORCE) {
    const found = existingCached(shortcode, key);
    if (found) return found;
  }

  const dir = path.join(THUMB_DIR, shortcode);
  fs.mkdirSync(dir, { recursive: true });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
      const ext = EXT_BY_TYPE[ct] || '.jpg';
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('empty body');
      const rel = path.join('thumbs', shortcode, key + ext);
      fs.writeFileSync(path.join(OUT_DIR, rel), buf);
      return rel.split(path.sep).join('/');
    } catch (err) {
      if (attempt === 2) {
        console.error(`  ! thumb failed (${err.message}) ${signedUrl.slice(0, 80)}…`);
        return existingCached(shortcode, key); // fall back to any prior copy
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

async function buildPortal(portal) {
  const domain = String(portal.domain).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const shortcode = portal.shortcode;
  const urlPath = String(portal.path || 'Portal').replace(/\s+/g, '');
  const base = `https://${domain}`;
  const portalUrl = `${base}/portals/${shortcode}/${urlPath}`;

  const meta = await getJSON(`${base}/portals/api/view/portals/shortcode/${shortcode}`);
  const sectionsResp = await getJSON(
    `${base}/portals/api/view/sections/portal/${shortcode}?expand=collectionPreviews`
  );

  const sections = [];
  for (const sec of (sectionsResp.items || [])) {
    if (sec.hidden) continue;

    const colMap = {};
    (sec.collections || []).forEach((c) => { colMap[c.id] = c; });

    const galleries = [];
    for (const el of (sec.elements || [])) {
      if (el.type !== 'card') continue;
      const d = el.data || {};
      const id = d.linkedCollectionId || d.collectionId;
      if (!id) continue;
      const col = colMap[id];
      const preview = col && (col.previewAssets || [])[0];
      const signed = previewThumbUrl(preview);
      const thumb = await cacheThumb(signed, shortcode); // relative path or null
      galleries.push({
        id,
        title: d.cardTitle || (col && col.title) || 'Gallery',
        count: (col && col.total_items) || null,
        thumb
      });
    }

    if (galleries.length) sections.push({ id: sec.id, name: sec.name || '', galleries });
  }

  return {
    portal: { name: meta.name || urlPath, shortcode, domain, path: urlPath, url: portalUrl },
    generatedAt: new Date().toISOString(),
    sections
  };
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const portals = cfg.portals || [];
  if (!portals.length) {
    console.error('No portals configured in ' + CONFIG_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let failures = 0;
  for (const p of portals) {
    try {
      const data = await buildPortal(p);
      fs.writeFileSync(path.join(OUT_DIR, `${p.shortcode}.json`), JSON.stringify(data, null, 2) + '\n');
      const galleryCount = data.sections.reduce((n, s) => n + s.galleries.length, 0);
      const cached = data.sections.reduce((n, s) => n + s.galleries.filter((g) => g.thumb).length, 0);
      console.log(
        `✓ ${p.shortcode} (${data.portal.name}): ${data.sections.length} section(s), ` +
        `${galleryCount} galleries, ${cached}/${galleryCount} thumbnails cached -> data/${p.shortcode}.json`
      );
    } catch (err) {
      failures++;
      console.error(`✗ ${p.shortcode}: ${err.message}`);
    }
  }
  if (failures) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
