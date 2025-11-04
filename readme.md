# Ghost Launcher

Ghost Launcher is a Next.js 16 + Solana wallet application that lets operators coordinate “ghost” token launches from a secure web console. It bundles wallet orchestration, launch monitoring, and authenticated API routes behind a wallet-sign-in flow.

## Project layout

- `apps/web/` – primary Next.js app (app router, API routes, Solana wallet UI)
- `docs/` – deployment and environment references (`ENV.md`, `DEPLOY_AWS.md`, `DEPLOY_HEROKU.md`)
- Root `package.json` – workspaces wrapper; run scripts with `npm run <command>` from repo root

## Requirements

- Node.js ≥ 18.18 (Amplify uses 18.x)
- npm 9+
- Access to a Solana RPC endpoint and AWS credentials (for S3 + Amplify)

## Getting started

1. Install dependencies (root workspace installs the web app):
   ```bash
   npm install
   ```
2. Copy `.env.example` (or create `.env.local`) inside `apps/web/` and fill in the variables from `docs/ENV.md`. At minimum you need:
   - `APP_JWT_SECRET`
   - `AWS_REGION`, `AWS_S3_BUCKET`
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   - `NEXT_PUBLIC_SOLANA_RPC_URL` or `SOLANA_RPC_URL`
3. Start the dev server:
   ```bash
   npm run dev
   ```
   This proxies to `apps/web` and serves the app on `http://localhost:3000`.

## Useful scripts

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Start Next.js dev server (apps/web)          |
| `npm run build`  | Production build for the web app             |
| `npm run start`  | Run the compiled Next.js server locally      |
| `npm run lint`   | ESLint via Next.js                           |

## Authentication flow

- `/api/auth/nonce` issues a nonce.
- Client signs the nonce via Solana wallet (`ensureLogin` helper).
- `/api/auth/verify` validates signature, issues an HTTP-only JWT cookie.
- Server routes and the app layout read the cookie and gate pages such as `/dashboard`, `/launch`, `/wallets`.

## File upload flow

- `apps/web/lib/storage.ts` wraps S3 uploads via `@aws-sdk/client-s3`.
- Configure `AWS_S3_ACL`, `AWS_S3_PUBLIC_URL`, and `UPLOADS_PREFIX` to control object visibility.

## Deployment (AWS Amplify)

1. Point Amplify at the repo and select the desired branch.
2. Build settings live in `amplify.yml`; key bits:
   - `appRoot: apps/web`
   - `framework: nextjs` so Amplify provisions the SSR runtime.
3. Ensure environment variables from `docs/ENV.md` are added to the Amplify app.
4. After deploy, map your custom domain (e.g., `ghostlaunch.xyz`) to the Amplify app.

Refer to `docs/DEPLOY_AWS.md` for a step-by-step Amplify walkthrough and `docs/DEPLOY_HEROKU.md` if you need a Heroku-style deployment.

## Troubleshooting

- **404 on Amplify** – confirm `framework: nextjs` remains in `amplify.yml` and redeploy so Amplify attaches the SSR runtime.
- **JWT not set** – make sure `/api/auth/verify` is reachable over HTTPS; cookies are `secure` in production.
- **S3 ACL errors** – `AWS_S3_ACL` must match `ObjectCannedACL`; values are filtered in `lib/storage.ts`.

For anything environment-specific, check `docs/ENV.md`. Cloud logs (Amplify console → Monitoring) are the fastest way to diagnose production issues.

