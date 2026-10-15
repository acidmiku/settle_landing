# Settle Landing

The landing page for [Settle](https://github.com/acidmiku/settle), a local editor for notes, code snippets and Markdown. Live at [settle.z01.tech](https://settle.z01.tech).

The page wears Settle. Its editor window is a working replica of the app's: same tokens, layout rules and syntax/Markdown libraries. `Esc` hides it and `Ctrl/Cmd+Shift+Space` brings it back from anywhere on the page. Visitors can switch the whole page into any of the app's ten designs.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | The page. |
| `styles.css` | Page styles and the ten page skins (`[data-skin]`). |
| `window.css` | The editor window, ported from the app's `themes.css`, `main.css` and `editor.css`, scoped to `.win`. |
| `js/main.js` | Hide/summon, the designs stage, design switching, keyboard section, release lookup. |
| `js/editor.js` | The editor replica: tabs, gutter, wrapping, syntax, preview, save and copy. |
| `js/syntax.js`, `js/languages.js` | Detection and rendering rules shared with the app. |
| `vendor/editor.js` | Highlight.js, Marked and DOMPurify, copied from the app's `src/vendor/` (licenses in `vendor/LICENSES.txt`). Loaded lazily. |
| `icons/`, `og.png` | Favicon, touch icon and the social preview card. |

When the app's designs or vendor bundle change, copy the new tokens into `window.css` (and the matching page skin in `styles.css`) and replace `vendor/editor.js`.

## Downloads

Download links come from the GitHub releases API at runtime: the newest non-draft, non-prerelease `v0.2.0`+ release with a `.exe` or `.dmg` asset. The response is cached in `localStorage` for 15 minutes. Without JavaScript or API access, links fall back to `releases/latest`. Nothing needs editing when a new version ships.

## Local preview

Static site, no build step. Serve the folder:

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`. Opening `index.html` from disk won't work, because ES modules need HTTP.

## Hosting

GitHub Pages, deployed from `master` / root. `.nojekyll` skips Jekyll; `CNAME` holds the custom domain.
