require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const db = require('./db');
const { generateBirthdayCard } = require('./cardGenerator');
const { sendBirthdayEmail } = require('./resendService');
const { initCron, triggerBirthdayCheck } = require('./cronService');

const app = express();
const PORT = process.env.PORT || 5001;

// Setup Uploads Directory
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

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

// File Upload endpoint for picture
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// 2. Card Preview Endpoint (returns PNG buffer image directly or base64)
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
      picture: member.picture,
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
