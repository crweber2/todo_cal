# Deploying Todo Calendar App to Koyeb

This todo/calendar app is containerized and ready for Koyeb deployment. The app includes:
- React frontend with calendar interface
- Node.js/Express backend with API endpoints
- File-based data storage for calendar sync
- Docker configuration for easy deployment

Files included:
- Dockerfile — builds React app and runs Node.js server
- .dockerignore — optimizes Docker build context
- server.js — Express server serving both API and static files

## Deploy on Koyeb from GitHub

1. **Sign in to Koyeb**: https://www.koyeb.com
2. **Create App** → Deploy a service → Select **GitHub** as the source and authorize access.
3. **Choose your GitHub repository** (todo_cal) and branch (main).
4. **Build method**: Docker (auto-detected from the Dockerfile at the repo root).
5. **Service settings**:
   - Name: `todo-cal` (or any name)
   - Region: your preferred region
   - Instance size: `Micro` is fine for small apps
   - Ports: Koyeb will auto-detect HTTP port. The container listens on `$PORT` (dynamically set by Koyeb).
   - Health Check: HTTP, Path: `/`
6. **Environment variables**:
   - `NODE_ENV=production` (already set in Dockerfile)
   - `R2_ACCOUNT_ID=<your_cloudflare_account_id>`
   - `R2_ACCESS_KEY_ID=<your_r2_access_key_id>`
   - `R2_SECRET_ACCESS_KEY=<your_r2_secret_access_key>`
   - `R2_BUCKET=<your_bucket_name>`
   - `R2_S3_ENDPOINT=<optional_custom_endpoint>` (optional; defaults to `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`)
7. **Click Deploy**. Koyeb will clone, build, and run the service.

## Enable Auto-Deploys

In the Koyeb service settings, enable "Automatic deployments" so new pushes to the main branch trigger a redeploy.

## Custom Domain (Optional)

- In Koyeb: App → Domains → Add Domain
- Follow the DNS instructions; SSL certs are handled automatically by Koyeb.

## Local Testing (Optional)

Build and run the Docker image locally:
```bash
docker build -t todo-cal .
docker run -p 3001:3001 -e PORT=3001 todo-cal
# Open http://localhost:3001
```

## Cloudflare R2 Persistence (Recommended for Production)

This app can persist calendar JSON in Cloudflare R2 (S3-compatible) so data survives Koyeb redeploys.

1) Create R2 bucket and credentials
- In Cloudflare dashboard: R2 → Create bucket (e.g., `todo-cal`).
- Create an API token with permissions to read/write your bucket:
  - R2 → Manage R2 API Tokens → Create API Token → Permissions: Object Read and Object Write for your bucket (or “Edit” for the bucket).
  - Save the Access Key ID and Secret Access Key.
- Find your Cloudflare Account ID (R2 dashboard → Overview).

2) Configure Koyeb environment variables (App → Service → Settings → Environment variables)
- R2_ACCOUNT_ID: your Cloudflare Account ID
- R2_ACCESS_KEY_ID: Access key ID from step 1
- R2_SECRET_ACCESS_KEY: Secret access key from step 1
- R2_BUCKET: your bucket name
- R2_S3_ENDPOINT (optional): S3 endpoint. If omitted, the app derives `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`

3) Deploy
- The server auto-detects R2 when the above environment variables are present and will:
  - Read calendar JSON from `s3://R2_BUCKET/calendar_<id>.json`
  - Write updates back to R2
- Check logs after deploy; you should see:
  - `Storage: Cloudflare R2 (S3-compatible)`
  - Bucket and endpoint info

Notes and best practices
- Do not expose R2 credentials to the browser; the server proxies all access.
- The API supports basic conflict detection using a `lastModified` timestamp field in the JSON.
- If no object exists for a calendar ID, the server returns an empty calendar schema; the first save will create it.
- For local development without R2 env vars, the server falls back to local filesystem under `data/`.

## App Features

- **Calendar Sync**: Each calendar gets a unique ID (e.g., `?id=001`, `?id=002`)
- **Data Persistence**: Calendar data is stored in `/app/data/` directory
- **Share URLs**: Click the share button to get shareable calendar links
- **Real-time Status**: Color-coded sync status (green=synced, yellow=saving, red=error)

## Troubleshooting

**Build fails:**
- Ensure the Dockerfile is at the repo root
- The image uses `node:18-alpine`. If you need different tools, switch to `node:18` (Debian)
- Confirm `package-lock.json` is committed for reliable `npm install`

**App doesn't load:**
- Check Koyeb logs for server startup errors
- Ensure Health Check path is set to `/`
- Verify the container is listening on the correct `$PORT`

**Data not persisting:**
- Note: Koyeb's ephemeral storage means calendar data resets on redeploys
- For production, consider adding a database or external storage solution

**Slow rebuilds:**
- Koyeb caches Docker layers
- Keep dependencies and lockfiles stable for faster builds
