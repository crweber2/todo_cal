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
6. **Environment variables** (optional): 
   - `NODE_ENV=production` (already set in Dockerfile)
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
