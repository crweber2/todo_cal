# Todo Calendar App

A React-based weekly calendar and task scheduler. Drag tasks into the calendar, manage meetings (including recurring), and track completed items. Data persists in localStorage.

## Tech stack
- React (Create React App)
- Tailwind CSS (via PostCSS)
- lucide-react icons

## Prerequisites
- Node.js 16+ (Node 18 LTS recommended)
- npm 8+

Check your versions:
- node -v
- npm -v

## Quick start (using setup script)
1) Clone the repo
   - git clone <your-repo-url> todo-calendar-app
   - cd todo-calendar-app

2) Run the setup script (installs dependencies; optional flag to start dev server)
   - macOS/Linux:
     - ./setup.sh         # install only
     - ./setup.sh --start # install and then start dev server
   - Windows (Git Bash):
     - sh setup.sh
     - sh setup.sh --start

This will run npm ci (or npm install if no lockfile) and optionally start the dev server.

## Manual setup (without script)
- npm ci     # preferred for clean installs
  - or: npm install
- npm start  # start development server on http://localhost:3000

## Common scripts
- npm start  - start dev server with hot reload
- npm run build - production build to build/
- npm test   - run tests (if any)

## Project notes
- Tailwind CSS is preconfigured with postcss.config.js and tailwind.config.js. No extra steps required.
- Data is stored in localStorage using keys:
  - todo-tasks
  - todo-meetings
  - todo-scheduledTasks
  - todo-completedTasks
  - todo-cancelledInstances

## Troubleshooting
- If styles don’t apply, ensure PostCSS and Tailwind dependencies are installed: npm ci
- If the dev server fails to start, delete node_modules and the lockfile, then reinstall:
  - rm -rf node_modules package-lock.json
  - npm install
- If you’re on an older Node version, upgrade to Node 18 LTS.

## Optional: Push to GitHub
- git remote add origin <your-repo-url>
- git push -u origin main
