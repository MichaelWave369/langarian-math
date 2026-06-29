# GitHub Pages Setup

The repo includes a Vite + React landing page in `web/` and a Pages workflow at `.github/workflows/pages.yml`.

## Local preview

```bash
cd web
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Publish with GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings**.
3. Go to **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Push a change under `web/` or run the `pages` workflow manually.

The Vite base path is configured for the project URL path:

```text
/langarian-math/
```

Expected public URL after Pages is enabled:

```text
https://michaelwave369.github.io/langarian-math/
```

If the deploy workflow fails before Pages is enabled, enable Pages first and rerun the workflow.
