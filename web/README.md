# Langarian Math Web

Small Vite + React landing page for the public Langarian Math repo.

## Local development

```bash
cd web
npm install
npm run dev
```

## Build

```bash
npm run build
```

The Vite config uses `base: '/langarian-math/'` for GitHub Pages project-site deployment.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. In the GitHub repo settings, set Pages source to **GitHub Actions**. The workflow will build `web/` and deploy `web/dist`.
