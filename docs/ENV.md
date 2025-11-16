# Environment Variables

Set these in your hosting environment (e.g., AWS Amplify environment variables) and in local `.env` for dev:

## Core
- `NEXT_PUBLIC_APP_URL`: Public base URL of the app (e.g., https://yourapp.example.com)
- `APP_URL`: Server-side base URL (defaults to `NEXT_PUBLIC_APP_URL`)

## Uploads (S3)
- `STORAGE_PROVIDER`: set to `s3`
- `AWS_REGION`: Region where the uploads bucket lives
- `S3_BUCKET`: Name of the uploads bucket
- `S3_PUBLIC_URL` (optional): CloudFront or bucket URL used to serve uploaded files
- `S3_ACL` (optional): e.g., `public-read` when bucket ownership permits ACLs
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (if not using an attached IAM role)
- `UPLOADS_PREFIX` (optional): folder prefix inside the bucket, defaults to `uploads`

## Auth
- `APP_JWT_SECRET`: Secret used to sign session JWTs (SIWS)

## Solana
- `NEXT_PUBLIC_SOLANA_CLUSTER`: `mainnet-beta`
- `SOLANA_RPC_URL`: Mainnet RPC endpoint (Helius, QuickNode, etc.)
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Optional public RPC URL for client-side reads

## Upstash Redis (State)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Upstash QStash (Jobs)
- `QSTASH_TOKEN`

## Pump.fun / Anchor
- `PUMP_PROGRAM_ID`: Pump.fun program ID (if not in IDL)
- `PUMPFUN_IPFS_URL` (optional): Pump.fun IPFS metadata upload endpoint (defaults to `https://pump.fun/api/ipfs`)

## Privacy Cash
- `PRIVACY_CASH_API_KEY`: API key for Privacy Cash server SDK

## Rate Limiting (optional)
- `RATE_LIMIT_WINDOW_MS`: e.g., `60000`
- `RATE_LIMIT_MAX`: e.g., `60`

Notes:
- Never store private keys on the server. All Solana signatures are made by the connected wallet on the client.
- Server validates session JWT on every API route; authorization by `sub` (wallet address) ownership only.


