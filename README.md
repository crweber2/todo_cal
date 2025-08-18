# Todo Calendar App

A full-stack React calendar and task scheduler with real-time sync capabilities. Features drag-and-drop task scheduling, recurring meetings, calendar sharing, and persistent data storage.

## Features

- **Interactive Calendar**: Drag tasks into time slots, resize by duration, switch between day/week views
- **Task Management**: Create, edit, complete, and organize tasks with color coding
- **Meeting Scheduler**: Add one-time or recurring meetings with notes
- **Calendar Sync**: Share calendars across devices with unique URLs
- **Real-time Status**: Visual sync indicators (green=synced, yellow=saving, red=error)
- **Data Persistence**: Server-side storage with automatic backups to localStorage

## Tech Stack

**Frontend:**
- React 18 (Create React App)
- Tailwind CSS for styling
- Lucide React icons
- Drag & drop interactions

**Backend:**
- Node.js with Express server
- File-based data storage
- RESTful API endpoints
- CORS enabled for development

**Deployment:**
- Docker containerization
- Koyeb-ready configuration

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 8+

Check your versions:
```bash
node -v
npm -v
```

## Quick Start

### Option 1: Using setup script
```bash
git clone https://github.com/crweber2/todo_cal.git
cd todo_cal
./setup.sh --start    # Install dependencies and start both server and client
```

### Option 2: Manual setup
```bash
git clone https://github.com/crweber2/todo_cal.git
cd todo_cal
npm install
npm run dev           # Starts both server (port 3001) and client (port 3000)
```

### Option 3: Production mode
```bash
npm run build         # Build React app
npm run server        # Start production server on port 3001
```

## Available Scripts

- `npm start` - Development React server (port 3000)
- `npm run server` - Production Node.js server (port 3001)
- `npm run dev` - Both server and client in development mode
- `npm run build` - Production build
- `npm test` - Run tests

## API Endpoints

- `GET /api/calendar/:id` - Load calendar data
- `POST /api/calendar/:id` - Save calendar data
- `POST /api/calendar/new` - Create new calendar
- `GET /api/calendars` - List all calendars (admin)

## Data Storage

**Server-side:**
- Cloudflare R2 (S3-compatible) when configured via environment variables:
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, optional `R2_S3_ENDPOINT`
  - Objects stored as `calendar_<id>.json`
- Fallback to local JSON files in `/data/` when R2 is not configured

**Client-side backup:** localStorage keys
- `todo-tasks`, `todo-meetings`, `todo-scheduledTasks`, `todo-completedTasks`, `todo-cancelledInstances`

## Calendar Sharing

1. Click the share button (color indicates sync status)
2. Copy the generated URL (e.g., `http://localhost:3001/?id=001`)
3. Share with others for collaborative calendar access
4. Each calendar has a unique ID for data isolation

## Docker Deployment

### Local Docker
```bash
docker build -t todo-cal .
docker run -p 3001:3001 todo-cal
```

### Koyeb Deployment
See [DEPLOY_KOYEB.md](DEPLOY_KOYEB.md) for detailed deployment instructions.

## Development

### Project Structure
```
src/
├── App.js          # Main React component
├── index.js        # React entry point
└── index.css       # Tailwind CSS imports

server.js           # Express server
data/               # Calendar data storage (created automatically)
build/              # Production React build
```

### Key Features Implementation

**Task Scheduling:**
- Drag tasks from sidebar to calendar slots
- 15-minute time increments
- Visual feedback and collision detection

**Meeting Management:**
- Double-click calendar to create meetings
- Recurring meeting support with series management
- Individual instance cancellation

**Sync Status:**
- Green: Successfully synced
- Yellow: Currently saving
- Red: Offline or sync error

## Troubleshooting

**Server won't start:**
- Check if port 3001 is available
- Ensure all dependencies are installed: `npm install`
- Check server logs for specific errors

**Styles not loading:**
- Verify Tailwind CSS is configured: `npm run build`
- Clear browser cache and restart dev server

**Data not persisting:**
- Check `/data/` directory permissions
- Verify server has write access to project directory
- Check browser console for API errors

**Calendar not syncing:**
- Check network connectivity
- Verify server is running on correct port
- Check browser developer tools for failed requests

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Commit changes: `git commit -m "Add feature"`
5. Push to branch: `git push origin feature-name`
6. Create a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).
