const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'build')));

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Generate unique calendar ID
function generateCalendarId() {
  const id = Math.random().toString(36).substring(2, 8);
  console.log('Generated calendar ID:', id);
  return id;
}

// API Routes

// Get calendar data
app.get('/api/calendar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, `calendar_${id}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      res.json(JSON.parse(data));
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Calendar doesn't exist, return empty state
        res.json({
          tasks: [],
          meetings: [],
          scheduledTasks: [],
          completedTasks: [],
          cancelledInstances: []
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error loading calendar:', error);
    res.status(500).json({ error: 'Failed to load calendar' });
  }
});

// Save calendar data
app.post('/api/calendar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, `calendar_${id}.json`);
    
    // Add timestamp to the data
    const dataWithTimestamp = {
      ...req.body,
      lastModified: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, JSON.stringify(dataWithTimestamp, null, 2));
    res.json({ success: true, lastModified: dataWithTimestamp.lastModified });
  } catch (error) {
    console.error('Error saving calendar:', error);
    res.status(500).json({ error: 'Failed to save calendar' });
  }
});

// Create new calendar
app.post('/api/calendar/new', async (req, res) => {
  try {
    let id;
    let attempts = 0;
    let exists = true;
    
    // Generate unique ID
    while (exists && attempts < 10) {
      id = generateCalendarId();
      attempts++;
      
      try {
        await fs.access(path.join(DATA_DIR, `calendar_${id}.json`));
        exists = true; // File exists, try again
      } catch {
        exists = false; // File doesn't exist, we can use this ID
      }
    }
    
    if (attempts >= 10) {
      throw new Error('Failed to generate unique ID');
    }
    
    // Create empty calendar with current data from request body
    const initialData = req.body || {};
    const emptyCalendar = {
      tasks: initialData.tasks || [],
      meetings: initialData.meetings || [],
      scheduledTasks: initialData.scheduledTasks || [],
      completedTasks: initialData.completedTasks || [],
      cancelledInstances: initialData.cancelledInstances || [],
      created: new Date().toISOString()
    };
    
    const filePath = path.join(DATA_DIR, `calendar_${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(emptyCalendar, null, 2));
    
    res.json({ id, success: true });
  } catch (error) {
    console.error('Error creating calendar:', error);
    res.status(500).json({ error: 'Failed to create calendar' });
  }
});

// List all calendars (for admin/debugging)
app.get('/api/calendars', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const calendars = files
      .filter(file => file.startsWith('calendar_') && file.endsWith('.json'))
      .map(file => file.replace('calendar_', '').replace('.json', ''));
    
    res.json({ calendars });
  } catch (error) {
    console.error('Error listing calendars:', error);
    res.status(500).json({ error: 'Failed to list calendars' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
async function startServer() {
  await ensureDataDir();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}

startServer().catch(console.error);
