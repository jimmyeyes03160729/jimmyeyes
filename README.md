# EasyStock Ops & Knowledge Center

A private, browser-local operations wiki for EasyStock. This is a separate static app, not part of the EasyStock production trading website.

## Local development

```sh
pnpm install
pnpm test
pnpm build
pnpm dev
```

The repository includes only `example-private-data.json`, with fake/example.invalid placeholders. Import your own `private-data.json` after signing in. Imported data is validated and stored in this browser's IndexedDB. Use **Export** for a local backup; the app never uploads data or pushes to GitHub.

## Firebase Google sign-in setup

1. Create a Firebase project and a Firebase **Web app**.
2. Enable **Authentication → Sign-in method → Google**.
3. In Authentication settings, add the final GitHub Pages hostname to **Authorized domains**.
4. At the app login screen, enter the Firebase Web app configuration values. They are stored only in this browser's localStorage; do not add them to this repository or to private JSON.
5. The UI allows only `jimmyeyes0316@gmail.com`; any other signed-in account is immediately signed out.

The Firebase web configuration is not a server credential, but this project deliberately keeps it out of the repository and app bundle. Firebase sign-in is an **UI access gate only**, not a security boundary for secrets or a substitute for server-side authorization. GitHub Pages serves a public static app. Do not publish real private data, credentials, or secrets in the repository. Browser-local IndexedDB is not encrypted; protect the device and keep offline backups safe.

## Prepare for first push

This directory is ready to become a Git repository. Do **not** create or commit `private-data.json`, `.env`, `secrets/`, or `credentials/`.

```sh
git init --initial-branch=main
git remote add origin https://github.com/jimmyeyes03160729/jimmyeyes.git
git add .
git commit -m "Initial commit: EasyStock Ops & Knowledge Center"
git push -u origin main
```

## GitHub Pages

The included workflow runs typecheck, tests, and build, then deploys only `dist/` as a static artifact. It does not deploy private data. After pushing to `main`:

1. Go to **Settings → Pages → Build and deployment** and select **GitHub Actions**.
2. The workflow will run on every push to `main`; it needs `pages: write` and `id-token: write` permissions (already set in `.github/workflows/deploy.yml`).
3. The Pages build uses the `/jimmyeyes/` base path. If the repository is renamed, update `vite.config.ts` and this README.

If the repository must be private, verify GitHub Pages visibility/availability for your GitHub plan before enabling deployment. A private repo does not make a GitHub Pages website public, but the static app itself is still publicly reachable at the Pages URL.

## Private-data handling

- `private-data.json`, `private-data-*.json`, `*.private.json`, `.env*`, `secrets/`, and `credentials/` are ignored by Git.
- Never commit a real private-data export. The example file is fake and uses reserved `.invalid` hosts and placeholder commands only.
- There are no analytics, API integrations for private data, remote JSON endpoints, or automatic repository pushes.
- Clearing site data/browser storage deletes the local IndexedDB copy. Export backups before clearing or changing devices.
