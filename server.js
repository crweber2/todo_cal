const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

// Storage config: Cloudflare R2 (S3-compatible)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
// You can override endpoint via R2_S3_ENDPOINT (e.g., R2-compatible gateway or custom domain)
// Otherwise we derive the default API endpoint from the account ID.
const R2_S3_ENDPOINT =
  process.env.R2_S3_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

const USE_R2 = Boolean(R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_S3_ENDPOINT);

let s3Client = null;
if (USE_R2) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_S3_ENDPOINT,
    forcePathStyle: true, // Required for Cloudflare R2 path-style addressing
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'build')));

// Ensure data directory exists (for filesystem mode)
async function ensureDataDir() {
  if (USE_R2) return;
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

// Default calendar structure
function emptyCalendar(initialData = {}) {
  return {
    tasks: initialData.tasks || [],
    meetings: initialData.meetings || [],
    scheduledTasks: initialData.scheduledTasks || [],
    completedTasks: initialData.completedTasks || [],
    cancelledInstances: initialData.cancelledInstances || [],
  };
}

// Filesystem helpers
async function readCalendarFS(id) {
  const filePath = path.join(DATA_DIR, `calendar_${id}.json`);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeCalendarFS(id, data) {
  const filePath = path.join(DATA_DIR, `calendar_${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function existsCalendarFS(id) {
  const filePath = path.join(DATA_DIR, `calendar_${id}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// R2 helpers
const r2KeyForId = (id) => `calendar_${id}.json`;

async function readCalendarR2(id) {
  const Key = r2KeyForId(id);
  const res = await s3Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key }));
  // SDK v3 provides transformToString in Node
  const body = await res.Body.transformToString('utf-8');
  return JSON.parse(body);
}

async function writeCalendarR2(id, data) {
  const Key = r2KeyForId(id);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    })
  );
}

async function existsCalendarR2(id) {
  const Key = r2KeyForId(id);
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.Name === 'NotFound') {
      return false;
    }
    // For R2, missing keys usually return 404 NoSuchKey
    if (err?.Code === 'NotFound' || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
      return false;
    }
    throw err;
  }
}

async function listCalendarsR2() {
  const calendars = [];
  let ContinuationToken = undefined;

  do {
    const res = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: 'calendar_',
        ContinuationToken,
      })
    );
    if (res.Contents) {
      for (const obj of res.Contents) {
        const key = obj.Key || '';
        if (key.startsWith('calendar_') && key.endsWith('.json')) {
          const id = key.replace('calendar_', '').replace('.json', '');
          calendars.push(id);
        }
      }
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return calendars;
}

// Unified storage functions
async function readExistingCalendar(id) {
  // Returns { existingData, existingLastModified } or nulls if not exists
  try {
    if (USE_R2) {
      const data = await readCalendarR2(id);
      return { existingData: data, existingLastModified: data.lastModified || null };
    } else {
      const data = await readCalendarFS(id);
      return { existingData: data, existingLastModified: data.lastModified || null };
    }
  } catch (err) {
    // Not found -> treat as new
    if (USE_R2) {
      if (
        err?.$metadata?.httpStatusCode === 404 ||
        err?.Code === 'NotFound' ||
        err?.name === 'NotFound' ||
        err?.name === 'NoSuchKey'
      ) {
        return { existingData: null, existingLastModified: null };
      }
    } else {
      if (err?.code === 'ENOENT') {
        return { existingData: null, existingLastModified: null };
      }
    }
    // Unexpected error
    throw err;
  }
}

async function loadCalendar(id) {
  try {
    if (USE_R2) {
      return await readCalendarR2(id);
    } else {
      return await readCalendarFS(id);
    }
  } catch (error) {
    // If not found, return an empty calendar
    if (USE_R2) {
      if (
        error?.$metadata?.httpStatusCode === 404 ||
        error?.Code === 'NotFound' ||
        error?.name === 'NotFound' ||
        error?.name === 'NoSuchKey'
      ) {
        return emptyCalendar();
      }
    } else {
      if (error?.code === 'ENOENT') {
        return emptyCalendar();
      }
    }
    throw error;
  }
}

async function persistCalendar(id, data) {
  if (USE_R2) {
    await writeCalendarR2(id, data);
  } else {
    await writeCalendarFS(id, data);
  }
}

async function calendarExists(id) {
  return USE_R2 ? existsCalendarR2(id) : existsCalendarFS(id);
}

// API Routes

// Get calendar data
app.get('/api/calendar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Ensure we don't create an "undefined" calendar
    if (id === 'undefined') {
      return res.status(400).json({ error: 'Invalid calendar ID' });
    }

    const data = await loadCalendar(id);
    res.json(data);
  } catch (error) {
    console.error('Error loading calendar:', error);
    res.status(500).json({ error: 'Failed to load calendar' });
  }
});

// Save calendar data (with simple timestamp-based conflict detection)
app.post('/api/calendar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'undefined') {
      return res.status(400).json({ error: 'Invalid calendar ID' });
    }

    const { clientLastModified, ...newData } = req.body;

    // Read existing calendar (if any)
    const { existingData, existingLastModified } = await readExistingCalendar(id);

    // Conflict check (timestamp-based)
    if (clientLastModified && existingLastModified) {
      const clientTime = new Date(clientLastModified);
      const serverTime = new Date(existingLastModified);
      if (serverTime > clientTime) {
        return res.status(409).json({
          error: 'Conflict detected',
          message: 'Calendar has been modified by another client',
          serverData: existingData,
          serverLastModified: existingLastModified,
        });
      }
    }

    // Determine if there are actual changes ignoring metadata
    let hasChanges = false;
    if (existingData) {
      const existingForCompare = { ...existingData };
      delete existingForCompare.lastModified;
      delete existingForCompare.created;

      const newForCompare = { ...newData };
      hasChanges = JSON.stringify(existingForCompare) !== JSON.stringify(newForCompare);
    } else {
      hasChanges = true;
    }

    const dataToSave = {
      ...newData,
      lastModified: hasChanges ? new Date().toISOString() : existingLastModified || new Date().toISOString(),
      created: existingData?.created || new Date().toISOString(),
    };

    if (hasChanges) {
      await persistCalendar(id, dataToSave);
    }

    res.json({
      success: true,
      lastModified: dataToSave.lastModified,
      hasChanges,
      message: hasChanges ? 'Calendar updated' : 'No changes detected',
    });
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
      exists = await calendarExists(id);
    }

    if (attempts >= 10) {
      throw new Error('Failed to generate unique ID');
    }

    // Create empty/seeded calendar
    const initialData = req.body || {};
    const newCalendar = {
      ...emptyCalendar(initialData),
      created: new Date().toISOString(),
    };

    await persistCalendar(id, newCalendar);

    res.json({ id, success: true });
  } catch (error) {
    console.error('Error creating calendar:', error);
    res.status(500).json({ error: 'Failed to create calendar' });
  }
});

// List all calendars (for admin/debugging)
app.get('/api/calendars', async (req, res) => {
  try {
    if (USE_R2) {
      const calendars = await listCalendarsR2();
      return res.json({ calendars });
    } else {
      const files = await fs.readdir(DATA_DIR);
      const calendars = files
        .filter((file) => file.startsWith('calendar_') && file.endsWith('.json'))
        .map((file) => file.replace('calendar_', '').replace('.json', ''));
      return res.json({ calendars });
    }
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
  if (!USE_R2) {
    await ensureDataDir();
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (USE_R2) {
      console.log('Storage: Cloudflare R2 (S3-compatible)');
      console.log(`R2 Bucket: ${R2_BUCKET}`);
      console.log(`R2 Endpoint: ${R2_S3_ENDPOINT}`);
    } else {
      console.log('Storage: Local filesystem');
      console.log(`Data directory: ${DATA_DIR}`);
    }
  });
}

startServer().catch(console.error);
