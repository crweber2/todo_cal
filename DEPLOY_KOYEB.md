# Deploying to Koyeb from GitLab

This app is containerized and ready for Koyeb. Koyeb will build the Dockerfile from your GitLab repository and run the resulting image.

Files included:
- Dockerfile — multi-stage build; compiles the React app and serves static files with `serve`
- .dockerignore — cuts down the Docker build context for faster builds

## 1) Push the repo to GitLab

Option A: Push local repo directly to GitLab
1. Create a new blank project in GitLab (e.g., https://gitlab.com/<your-username>/todo_cal).
2. Add GitLab as a remote and push:
   ```
   git remote add gitlab https://gitlab.com/<your-username>/todo_cal.git
   git push -u gitlab main
   ```

Option B: Mirror GitHub → GitLab (Pull Mirror)
1. In GitLab: Settings → Repository → Mirroring repositories.
2. Add a new mirror with the GitHub repo URL (https://github.com/crweber2/todo_cal.git) and provide a GitHub access token with at least read permissions.
3. Set “Mirror direction” to Pull and save. You can trigger a manual sync to copy the code immediately.

## 2) Deploy on Koyeb from GitLab

1. Sign in to Koyeb: https://www.koyeb.com
2. Create App → Deploy a service → Select GitLab as the source and authorize access.
3. Choose your GitLab repository (todo_cal) and branch (main).
4. Build method: Docker (auto-detected from the Dockerfile at the repo root).
5. Service settings:
   - Name: `todo-cal` (or any name)
   - Region: your preferred region
   - Instance size: `Micro` is fine for small apps
   - Ports: Koyeb will detect an HTTP port automatically. The container listens on `$PORT` (set in the Dockerfile command).
   - Health Check: HTTP, Path: `/`
6. Environment (optional): `NODE_ENV=production` (the Docker image already sets this).
7. Click Deploy. Koyeb will clone, build, and run the service.

## 3) Enable auto-deploys
In the Koyeb service settings, enable “Automatic deployments” so new pushes to the selected GitLab branch trigger a redeploy.

## 4) Custom domain (optional)
- In Koyeb: App → Domains → Add Domain
- Follow the DNS instructions; SSL certs are handled automatically by Koyeb.

## 5) Verify locally (optional)
Build and run the Docker image locally:
```
docker build -t todo-cal .
docker run -p 3000:3000 -e PORT=3000 todo-cal
# Open http://localhost:3000
```

## 6) Troubleshooting
- Build fails:
  - Ensure the Dockerfile is at the repo root.
  - The image uses `node:18-alpine`. If you need a different toolchain, switch to `node:18` (Debian) or add required build deps.
  - Confirm `package-lock.json` is committed so `npm ci` works reliably.
- Blank page on reload:
  - The container uses `serve -s build` which enables SPA fallback; make sure Koyeb Health Check path is `/`.
- Slow rebuilds:
  - Koyeb caches Docker layers. Keeping dependencies and lockfiles stable yields faster builds.
