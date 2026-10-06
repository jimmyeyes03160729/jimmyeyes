# EasyStock Ops Deployment Checklist

> For repository: `jimmyeyes`  
> Pages base path: `/jimmyeyes/`  
> No real EasyStock private data, credentials, or `private-data.json` should be added to this repository.

## Pre-flight

- [ ] `pnpm install` completes without errors.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` produces `dist/` (ignored by Git).
- [ ] `example-private-data.json` contains only placeholders and `.invalid` domains.
- [ ] `.gitignore` excludes `private-data.json`, `.env*`, `secrets/`, `credentials/`, `dist/`, `node_modules/`.

## Repository setup

- [ ] `git init --initial-branch=main`
- [ ] Add remote: `git remote add origin https://github.com/jimmyeyes03160729/jimmyeyes.git`
- [ ] `git add .`
- [ ] `git commit -m "Initial commit: EasyStock Ops & Knowledge Center"`
- [ ] `git push -u origin main`

## GitHub repository settings

- [ ] Repository name is `jimmyeyes` (matches Vite base path `/jimmyeyes/`).
- [ ] **Settings → Pages → Build and deployment** is set to **GitHub Actions**.
- [ ] Workflow `Test and deploy static app` runs successfully on `main`.
- [ ] Pages URL becomes `https://jimmyeyes03160729.github.io/jimmyeyes/`.

## Firebase setup

- [ ] Create or open the Firebase project for this app.
- [ ] Register a Firebase **Web app**.
- [ ] Enable **Authentication → Sign-in method → Google**.
- [ ] Add the Pages domain to **Authentication → Settings → Authorized domains**:
  - `jimmyeyes03160729.github.io`
- [ ] Open the deployed site and enter the Firebase Web app config at the login screen.
- [ ] Sign in with `jimmyeyes0316@gmail.com` only.

## First use

- [ ] After signing in, import your local `private-data.json` from a safe backup.
- [ ] Confirm the app loads the data from IndexedDB on the next visit.
- [ ] Use **Export** regularly to back up `private-data.json` to your own storage.
- [ ] Never commit a real `private-data.json` export to Git.

## Post-deploy reminders

- The email allowlist is a UI gate only; the real protection is keeping secrets out of the repository.
- The static site is public on GitHub Pages; do not put IP addresses, credentials, or keys in any committed file.
- Browser storage (localStorage + IndexedDB) is device-local and not encrypted. Protect the device and backups.
