# Heroku Deployment

1) Create app and set stack to container or heroku-22

2) Set Config Vars (see `docs/ENV.md`)
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_PRIVY_APP_ID
- PRIVY_APP_SECRET
- NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta
- SOLANA_RPC_URL
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- QSTASH_TOKEN (optional if not using background webhooks)
- PUMP_PROGRAM_ID
- PRIVACY_CASH_API_KEY
- RATE_LIMIT_WINDOW_MS=60000
- RATE_LIMIT_MAX=60

3) Procfile
The repo includes a root `Procfile`:

```
web: cd apps/web && npm run start -- -p ${PORT:-3000}
```

4) Build and deploy
- `heroku git:remote -a <app>`
- `git push heroku main`

5) Domain
- Ensure `NEXT_PUBLIC_APP_URL` matches your Heroku domain

6) Notes
- Use a dedicated mainnet RPC (Helius/QuickNode) for reliability
- Configure Privy OAuth providers in Privy dashboard