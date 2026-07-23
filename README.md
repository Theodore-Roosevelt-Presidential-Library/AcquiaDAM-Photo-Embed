# AcquiaDAM-Photo-Embed

A lightweight, dependency-free embed for **Acquia DAM (Widen) portals**. Drop it on any page and it renders a responsive, self-sizing iframe of your portal. Galleries open **natively inside the frame**, so visitors browse and download press assets without leaving your site. It works with **any** Acquia DAM portal — just point it at the portal URL.

## Why this exists

The previous embed was a plain iframe locked to `height="700"`, which produced a cramped box with an awkward inner scrollbar. This version fixes the sizing (fills the viewport responsively) and turns the embed into a single, reusable, configurable snippet.

## Quick start

Paste this where you want the portal to appear (e.g. a WordPress **Custom HTML** block, a Duda HTML widget, or any raw-HTML section). Host `acquia-portal-embed.js` somewhere on your site and reference it, or use your own CDN/path.

```html
<script
  src="/path/to/acquia-portal-embed.js"
  data-portal-url="https://trlibrary.acquiadam.com/portals/ob41lpui/PressPortal"
  data-height="responsive"
  data-embedded="true"></script>
```

That's it. The script inserts the gallery iframe right where the tag sits.

### Point it at a different portal

Change one attribute:

```html
data-portal-url="https://YOURACCOUNT.acquiadam.com/portals/SHORTCODE/PortalName"
```

Or build the URL from parts instead of pasting it whole:

```html
<script
  src="/path/to/acquia-portal-embed.js"
  data-domain="trlibrary.acquiadam.com"
  data-shortcode="ob41lpui"
  data-path="PressPortal"></script>
```

## Configuration

All options are `data-*` attributes on the `<script>` tag (or keys passed to `AcquiaPortalEmbed.init({...})`).

| Attribute            | Default        | Description |
|----------------------|----------------|-------------|
| `data-portal-url`    | —              | Full portal URL. Provide this **or** `data-domain` + `data-shortcode`. |
| `data-domain`        | —              | Portal host, e.g. `trlibrary.acquiadam.com`. |
| `data-shortcode`     | —              | Portal short code, e.g. `ob41lpui`. |
| `data-path`          | `Portal`       | Portal URL name segment, e.g. `PressPortal`. |
| `data-embedded`      | `true`         | Appends `?embedded=true` (Acquia's lighter presentation). |
| `data-collection`    | —              | A collection/gallery ID to open directly on load (deep-link). |
| `data-height`        | `responsive`   | `responsive`, a pixel value (`1200` / `1200px`), or any CSS length (`90vh`). |
| `data-min-height`    | `680`          | Minimum px height in `responsive` mode. |
| `data-max-height`    | `1500`         | Maximum px height in `responsive` mode. |
| `data-viewport-ratio`| `0.9`          | Fraction of the window height used in `responsive` mode. |
| `data-border-radius` | `10px`         | Corner rounding of the frame. |
| `data-shadow`        | `true`         | Subtle drop shadow around the frame. |
| `data-background`    | `#ffffff`      | Frame background (shown while loading). |
| `data-target`        | —              | CSS selector of a container to render into (instead of inline). |
| `data-title`         | `Press portal gallery` | Accessible iframe title. |

### Programmatic use

If your CMS strips inline `data-*` config, include the library once and call it yourself:

```html
<div id="press-portal"></div>
<script src="/path/to/acquia-portal-embed.js"></script>
<script>
  AcquiaPortalEmbed.init({
    portalUrl: 'https://trlibrary.acquiadam.com/portals/ob41lpui/PressPortal',
    target: '#press-portal',
    height: 'responsive'
  });
</script>
```

### Deep-link to a specific gallery

Open straight into one collection by passing its ID:

```html
data-collection="5759cf07-5c2e-4ff9-a15b-ac5a08a7bd77"
```

(The ID is the hash you see in the portal URL when you open a gallery, e.g. `…/PressPortal#5759cf07-…`.)

## How it works (and the one limitation)

- **No backend, no API keys, no CORS proxy.** The Acquia portal JSON API blocks cross-origin browser requests, so a script on your domain can't fetch portal data directly. The portal *page*, however, renders fine inside a cross-origin iframe — so this embed uses the iframe and always shows live, current galleries.
- **Height is responsive, not pixel-perfect.** Acquia portals don't broadcast their content height to the parent page, so a cross-origin frame can't shrink-wrap to the exact height of its content. Instead the embed sizes the frame to a generous share of the viewport (within `min-height`/`max-height`) so the gallery grid shows without a cramped scrollbar, and the portal manages its own internal scrolling. If Acquia ever enables `postMessage` height broadcasting (or an iframe-resizer child script), true auto-fit could be added.

## Files

- `acquia-portal-embed.js` — the embed library (this is what you host and reference).
- `demo.html` — a working demo, preconfigured for the TR Library Press Portal.
- `README.md` — this file.

## License

MIT — Theodore Roosevelt Presidential Library.
