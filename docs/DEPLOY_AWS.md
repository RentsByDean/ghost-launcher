# AWS Deployment (Amplify Hosting)

This project is a monorepo (`apps/web`) using Next.js (App Router). The simplest way to deploy on AWS is Amplify Hosting, which supports Next.js SSR out of the box.

## 1) Prepare the repo
- We removed Heroku artifacts (`Procfile`, `heroku-postbuild`).
- Added `amplify.yml` at the repo root with `appRoot: apps/web` so Amplify builds the Next.js app in the monorepo.

## 2) Create an Amplify App
1. In the AWS Console, open Amplify → Hosting → Get started.
2. Connect your GitHub repo and select the branch to deploy.
3. In “Monorepo app root”, set to `apps/web`.
4. Amplify will auto-detect `amplify.yml` at the repo root. Confirm the build settings.

## 3) Create the uploads bucket (S3)
1. In the AWS Console, open S3 → Create bucket.
2. Enter a globally unique bucket name (e.g., `ghost-launch-uploads-prod`) and pick the same region you deploy Amplify in.
3. Leave Object Ownership as “ACLs disabled” unless you have a legacy requirement.
4. Keep “Block public access” ON for safety. Instead of making the whole bucket public, we’ll add a policy that only exposes the `uploads/` prefix.
5. Finish the wizard and note the bucket name and region.

### Optional: allow public reads of uploaded assets
If you want the URLs returned by the API to be publicly accessible, add a bucket policy that grants read access to objects beneath the prefix:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPublicReadUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ghost-launch-uploads-prod/uploads/*"
    }
  ]
}
```

Swap the bucket name for yours. You can also front the bucket with CloudFront and set `AWS_S3_PUBLIC_URL` to the CloudFront URL instead of opening the bucket to the public.

## 4) Grant the app write access
1. In IAM → Policies, create a new policy (JSON editor) such as:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject","s3:PutObjectAcl","s3:GetObject"],
      "Resource": "arn:aws:s3:::ghost-launch-uploads-prod/uploads/*"
    }
  ]
}
```

2. Create an IAM user with programmatic access and attach the policy.
3. Copy the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. (You can skip this if the Amplify service role already has S3 access.)
4. Store the keys as Amplify environment variables or AWS Secrets Manager values referenced by Amplify.

## 5) Environment variables
Set these in Amplify → App settings → Environment variables (mirror your local `.env`):
- `APP_URL` / `NEXT_PUBLIC_APP_URL`: Public base URL (e.g., `https://app.example.com`)
- `STORAGE_PROVIDER=s3`
- `AWS_REGION` (same region as the bucket)
- `AWS_S3_BUCKET` (bucket name)
- `AWS_S3_PUBLIC_URL` (optional – CloudFront or S3 URL to serve uploads)
- `AWS_S3_ACL=public-read` (optional – only if bucket ownership allows ACLs)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (only when not using an attached IAM role)
- `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_CLUSTER`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN`
- `PRIVACY_CASH_API_KEY`
- Any other variables listed in `docs/ENV.md`

Tip: After adding a custom domain, update `APP_URL`/`NEXT_PUBLIC_APP_URL` to match, then redeploy.

## 6) Custom domain
In Amplify → Domain management:
1. Connect your domain and add a subdomain for your app, e.g., `app.example.com`.
2. Wait for DNS verification. Amplify will provision SSL automatically.

## 7) Redeploys
Amplify automatically rebuilds and deploys on each push to the configured branch. Use branch previews for PRs if desired.

---

## Alternative: AWS App Runner (container)
If you prefer to deploy a containerized Next.js server:
1. Add a Dockerfile that builds and runs `next start` for `apps/web`.
2. Build and push the image to Amazon ECR.
3. Create an App Runner service from the ECR image and configure environment variables.
4. Map your custom domain to the App Runner service.

App Runner is great for simple container hosting; Amplify is simpler for Next.js SSR with CI/CD and previews.


