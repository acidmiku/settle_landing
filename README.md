# Settle Landing

Single-page landing site for **Settle**.

## Local preview

This is a static site (no build step). Open `index.html` in a browser, or run a tiny local server:

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`.

## GitHub Pages

Recommended setup:

1. GitHub repo → **Settings** → **Pages**
2. **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `master` / `(root)`

## Custom domain

In repo root, add a file named `CNAME` containing your domain (example):

```text
settle.example.com
```

Then set the same domain in **Settings → Pages → Custom domain**.

## Project links

- App repo: `https://github.com/acidmiku/settle`
- Releases: `https://github.com/acidmiku/settle/releases`

