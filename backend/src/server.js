require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const db = require('./db');
const { generateBirthdayCard } = require('./cardGenerator');
const { sendBirthdayEmail } = require('./resendService');
const { initCron, triggerBirthdayCheck } = require('./cronService');

const app = express();
const PORT = process.env.PORT || 5001;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

// Resolves a stored picture path to a full URL the backend can loadImage() from
function resolvePictureUrl(picture) {
  if (!picture) return '';
  if (picture.startsWith('http://') || picture.startsWith('https://')) return picture;
  // It's a relative path like /uploads/photo-xxx.webp
  return `${BACKEND_URL}${picture}`;
}

// Setup Cloudinary credentials (trimming quotes if present)
const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').replace(/^["']|["']$/g, '').trim();
const apiKey    = (process.env.CLOUDINARY_API_KEY || '').replace(/^["']|["']$/g, '').trim();
const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').replace(/^["']|["']$/g, '').trim();

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
  console.log(`[Cloudinary] Configured for image uploads (Cloud: ${cloudName}).`);
}

// Multer Storage Configuration (MemoryStorage for Cloudinary streaming)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Database & Cron
db.initDB();
initCron();

// --- API ROUTES ---

// 1. Members Endpoints
app.get('/api/members', async (req, res) => {
  try {
    const members = await db.getMembers();
    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const { name, email, birthday, picture, designation } = req.body;
    if (!name || !email || !birthday) {
      return res.status(400).json({ success: false, error: 'Name, email, and birthday are required.' });
    }
    const newMember = await db.addMember({ name, email, birthday, picture, designation });
    res.status(201).json({ success: true, data: newMember });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/members/:id', async (req, res) => {
  try {
    const { name, email, birthday, picture, designation } = req.body;
    const updated = await db.updateMember(req.params.id, { name, email, birthday, picture, designation });
    if (!updated) return res.status(404).json({ success: false, error: 'Member not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/members/:id', async (req, res) => {
  try {
    await db.deleteMember(req.params.id);
    res.json({ success: true, message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// File Upload endpoint for picture (Uploads to Cloudinary & returns secure_url)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

  if (cloudName && apiKey && apiSecret) {
    try {
      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'cpp_birthday_cards',
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      const result = await uploadPromise;
      console.log('[Cloudinary] Upload success:', result.secure_url);
      return res.json({ success: true, url: result.secure_url });
    } catch (err) {
      console.error('[Cloudinary] Upload error:', err.message || err);
      return res.status(500).json({ success: false, error: `Cloudinary upload failed: ${err.message || 'Unknown error'}` });
    }
  }

  return res.status(500).json({ success: false, error: 'Cloudinary credentials missing on backend server.' });
});

// 2. Card Preview Endpoint
app.get('/api/card/preview', async (req, res) => {
  try {
    const { name, designation, picture, quote, logoUrl } = req.query;
    const settings = await db.getSettings();

    const cardBuffer = await generateBirthdayCard({
      name: name || 'Team Member Name',
      designation: designation || 'Designation Title',
      picture: picture || '',
      quote: quote || settings.quote_text,
      logoUrl: logoUrl || settings.logo_url
    });

    res.setHeader('Content-Type', 'image/png');
    res.send(cardBuffer);
  } catch (err) {
    res.status(500).send(`Error rendering card: ${err.message}`);
  }
});

// 3. Manual Birthday Card Send Trigger for a Specific Member
app.post('/api/members/:id/send-card', async (req, res) => {
  try {
    const members = await db.getMembers();
    const member = members.find(m => m.id == req.params.id);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    const settings = await db.getSettings();
    const cardBuffer = await generateBirthdayCard({
      name: member.name,
      designation: member.designation,
      picture: resolvePictureUrl(member.picture),
      quote: settings.quote_text,
      logoUrl: settings.logo_url
    });

    const result = await sendBirthdayEmail({ member, cardBuffer });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Cron Manual Execution / Render Cron Endpoint
app.post('/api/cron/trigger', async (req, res) => {
  try {
    const report = await triggerBirthdayCheck();
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Logs & Settings
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await db.getEmailLogs();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    await db.saveSettings(req.body);
    res.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend build static files if built
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[Backend] Server listening on http://localhost:${PORT}`);
});
