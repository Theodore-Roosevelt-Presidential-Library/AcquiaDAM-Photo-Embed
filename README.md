# AcquiaDAM-Photo-Embed

A lightweight, dependency-free embed that renders an **Acquia DAM (Widen) press portal** as **native gallery tiles** on your own page. The grid grows to fit its content — no fixed-height iframe, no interior scrollbar. Clicking a tile opens that specific gallery in a **lightbox** (an embedded, deep-linked iframe of the real portal), so visitors browse and **download** press assets without leaving your site.

It works with **any** Acquia DAM portal — a small scheduled job snapshots the portal's galleries so the page can render them.

## How it works

```
Acquia portal ──(GitHub Action, every 6h)──▶ data/<shortcode>.json ──(GitHub Pages)──▶ your page
                  scripts/generate-portal-data.js                     acquia-portal-embed.js renders tiles
```

1. **Snapshot.** `scripts/generate-portal-data.js` fetches the portal's sections and galleries (titles, item counts, and Acquia's own pre-signed preview thumbnails) and writes a small static `data/<shortcode>.json`. It runs server-side, where Acquia's cross-origin block doesn't apply.
2. **Host.** The JSON is committed to this repo and served by **GitHub Pages** (`https://portalphotos.labs.trlibrary.com/…`), which adds the CORS header the browser needs.
3. **Render.** `acquia-portal-embed.js`, dropped on your site, fetches that JSON and builds the native tile grid. Because the tiles are ordinary page content, the block auto-sizes to fit — solving the fixed-height/scrollbar problem of a raw portal iframe.
4. **Open.** Clicking a tile opens the real gallery, deep-linked by path (`…/PressPortal/c/{collectionId}/s/{sectionId}?embedded=true`), inside a lightbox iframe with its native download controls.

### Why not just fetch the portal live, or auto-size an iframe?

The Acquia portal JSON API sends no CORS headers, so a browser on your domain can't read it directly — hence the server-side snapshot. And a raw cross-origin portal iframe can't auto-fit its height (Acquia broadcasts no height and we can't inject a script into their frame), which is why the tiles are rendered natively instead.

## Quick start

Paste this where you want the galleries to appear (a WordPress **Custom HTML** block, a Duda HTML widget, any raw-HTML section):

```html
<script
  src="https://portalphotos.labs.trlibrary.com/acquia-portal-embed.js"
  data-data-url="https://portalphotos.labs.trlibrary.com/data/ob41lpui.json"
  data-accent="#1f5c3d"></script>
```

That's the whole embed. The tiles render inline where the tag sits, and grow to fit.

### Use it for a different portal

1. Add the portal to `config.json`:

   ```json
   { "portals": [
       { "domain": "trlibrary.acquiadam.com", "shortcode": "ob41lpui", "path": "PressPortal" },
       { "domain": "YOURACCT.acquiadam.com", "shortcode": "SHORTCODE", "path": "PortalName" }
   ] }
   ```

   (`path` is the portal's URL name — the segment after the shortcode, spaces removed, e.g. `PressPortal`.)

2. Commit. The GitHub Action regenerates `data/<shortcode>.json` on the next run (or trigger **Run workflow** manually).
3. Point a second embed at `…/data/<shortcode>.json`.

## Configuration

All options are `data-*` attributes on the `<script>` tag (or keys to `AcquiaPortalEmbed.init({...})`).

| Attribute                 | Default          | Description |
|---------------------------|------------------|-------------|
| `data-data-url`           | — (required)     | URL of the JSON snapshot. |
| `data-target`             | —                | CSS selector to render into (default: inline, after the script). |
| `data-min-tile`           | `260`            | Minimum tile width (px); the grid auto-fills columns. |
| `data-gap`                | `18`             | Grid gap (px). |
| `data-radius`             | `12`             | Corner radius (px). |
| `data-accent`             | `#1f5c3d`        | Heading rule + count-badge color. |
| `data-aspect`             | `3 / 2`          | Tile thumbnail aspect ratio. |
| `data-show-section-headings` | `true`        | Show each section's name as a heading. |
| `data-show-counts`        | `true`           | Show the "N photos" badge on each tile. |
| `data-lightbox`           | `true`           | `true` = open in lightbox; `false` = open in a new tab. |
| `data-embedded`           | `true`           | Use Acquia's `?embedded=true` mode in the lightbox iframe. |
| `data-title`              | `Press gallery`  | Accessible label for the region. |

### Programmatic use

```html
<div id="press"></div>
<script src="https://portalphotos.labs.trlibrary.com/acquia-portal-embed.js"></script>
<script>
  AcquiaPortalEmbed.init({
    dataUrl: 'https://portalphotos.labs.trlibrary.com/data/ob41lpui.json',
    target: '#press'
  });
</script>
```

## Keeping it fresh

Acquia's preview thumbnail URLs are pre-signed and **expire (~7 days)**. The GitHub Action (`.github/workflows/update-portal-data.yml`) regenerates the snapshot **every 6 hours**, so thumbnails are always refreshed well before expiry. You can also run it on demand from the repo's **Actions** tab, and it auto-runs whenever `config.json` or the generator changes.

## Files

| File | Purpose |
|------|---------|
| `acquia-portal-embed.js` | The embed. Renders native tiles + lightbox. Host and reference this. |
| `scripts/generate-portal-data.js` | Node generator that writes the `data/<shortcode>.json` snapshot. |
| `config.json` | List of portals to snapshot. |
| `data/<shortcode>.json` | Generated snapshot(s), served via GitHub Pages. |
| `.github/workflows/update-portal-data.yml` | Scheduled refresh (every 6h) + manual trigger. |
| `demo.html` | Working demo, preconfigured for the TR Library Press Portal. |

## Running the generator locally

```bash
node scripts/generate-portal-data.js         # uses config.json
```

Requires Node 18+ (uses the built-in `fetch`).

## License

MIT — Theodore Roosevelt Presidential Library.
