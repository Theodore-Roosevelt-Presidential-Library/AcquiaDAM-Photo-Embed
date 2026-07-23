#!/usr/bin/env node
/*
 * generate-portal-data.js
 * ------------------------------------------------------------------
 * Fetches public gallery data from one or more Acquia DAM (Widen)
 * portals and writes a static JSON snapshot per portal into ./data/.
 *
 * Why a snapshot?
 *   The Acquia portal JSON API does not send CORS headers, so a browser
 *   on your own website cannot read it directly. This script runs
 *   server-side (locally or in GitHub Actions) where CORS does not
 *   apply, and produces a small static file the embed can read from
 *   your own domain (served here via GitHub Pages, which adds CORS).
 *
 * The snapshot contains only public press data: gallery titles, item
 * counts, and Acquia's own pre-signed preview thumbnail URLs. Those
 * signed URLs expire (~7 days), so this script is scheduled to re-run
 * regularly (see .github/workflows/update-portal-data.yml) to refresh
 * them well before expiry.
 *
 * Usage:  node scripts/generate-portal-data.js [config.json]
 * Node 18+ (uses global fetch).
 * ------------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.resolve(ROOT, process.argv[2] || 'config.json');
const OUT_DIR = path.resolve(ROOT, 'data');

// Preferred thumbnail sizes, in order of preference.
const THUMB_1X = ['600px', '300px', '1080px', '160px', '125px'];
const THUMB_2X = ['1080px', '2048px', '600px'];

function pickThumb(thumbnails, order) {
  if (!thumbnails) return null;
  for (const k of order) {
    if (thumbnails[k]) return thumbnails[k];
  }
  // Fall back to whatever exists.
  const keys = Object.keys(thumbnails);
  return keys.length ? thumbnails[keys[0]] : null;
}

function assetThumbs(asset) {
  if (!asset) return { thumb: null, thumb2x: null };
  const t =
    (asset.image_previews && asset.image_previews.thumbnails) ||
    (asset.spinset_properties && asset.spinset_properties.thumbnails) ||
    null;
  return { thumb: pickThumb(t, THUMB_1X), thumb2x: pickThumb(t, THUMB_2X) };
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
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

  const sections = (sectionsResp.items || [])
    .filter((sec) => !sec.hidden)
    .map((sec) => {
      // Map collection id -> collection (holds title, count, preview assets).
      const colMap = {};
      (sec.collections || []).forEach((c) => { colMap[c.id] = c; });

      const galleries = [];
      (sec.elements || []).forEach((el) => {
        if (el.type !== 'card') return;
        const d = el.data || {};
        const id = d.linkedCollectionId || d.collectionId;
        if (!id) return;
        const col = colMap[id];
        const preview = col && (col.previewAssets || [])[0];
        const thumbs = assetThumbs(preview);
        galleries.push({
          id,
          title: d.cardTitle || (col && col.title) || 'Gallery',
          count: (col && col.total_items) || null,
          thumb: thumbs.thumb,
          thumb2x: thumbs.thumb2x
        });
      });

      return { id: sec.id, name: sec.name || '', galleries };
    })
    .filter((sec) => sec.galleries.length > 0);

  return {
    portal: {
      name: meta.name || urlPath,
      shortcode,
      domain,
      path: urlPath,
      url: portalUrl
    },
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
      const outFile = path.join(OUT_DIR, `${p.shortcode}.json`);
      fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n');
      const galleryCount = data.sections.reduce((n, s) => n + s.galleries.length, 0);
      console.log(
        `✓ ${p.shortcode} (${data.portal.name}): ${data.sections.length} section(s), ${galleryCount} galler${galleryCount === 1 ? 'y' : 'ies'} -> data/${p.shortcode}.json`
      );
    } catch (err) {
      failures++;
      console.error(`✗ ${p.shortcode}: ${err.message}`);
    }
  }
  if (failures) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
