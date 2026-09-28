require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const sharp = require('sharp');

const db = require('./db');
const { generateBirthdayCard } = require('./cardGenerator');
const { sendBirthdayEmail } = require('./resendService');
const { initCron, triggerBirthdayCheck } = require('./cronService');

const app = express();
const PORT = process.env.PORT || 5001;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

// Resolves a stored picture path to a full URL, Buffer, or path the backend can loadImage() from
async function resolvePictureUrl(picture, memberId = null) {
  if (memberId) {
    const photo = await db.getMemberPhoto(memberId);
    if (photo && photo.photo_data) return photo.photo_data;
  }
  if (!picture) return '';
  if (picture.startsWith('/api/members/') && picture.endsWith('/photo')) {
    const match = picture.match(/\/api\/members\/(\d+)\/photo/);
    if (match) {
      const photo = await db.getMemberPhoto(match[1]);
      if (photo && photo.photo_data) return photo.photo_data;
    }
  }
  if (picture.startsWith('http://') || picture.startsWith('https://') || picture.startsWith('data:')) {
    return picture;
  }
  const relativePath = picture.startsWith('/') ? picture : `/${picture}`;
  const localFilePath = path.join(__dirname, '..', relativePath);
  if (fs.existsSync(localFilePath)) {
    return localFilePath;
  }
  return '';
}

// Multer Storage Configuration (MemoryStorage for sharp image resizing)
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

// 2. Photo Upload & Serve Endpoints (Shrinks to 400x400 WebP via sharp and stores in Neon BYTEA)
app.post('/api/members/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No photo provided' });
    }
    const buf = await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();

    const updated = await db.updateMemberPhoto(req.params.id, buf, 'image/webp');
    res.json({ success: true, data: updated, photoUrl: `/api/members/${req.params.id}/photo` });
  } catch (err) {
    console.error('[upload photo error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/members/:id/photo', async (req, res) => {
  try {
    const photo = await db.getMemberPhoto(req.params.id);
    if (!photo || !photo.photo_data) {
      return res.status(404).end();
    }
    res.set('Content-Type', photo.photo_mime || 'image/webp');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(photo.photo_data);
  } catch (err) {
    console.error('[serve photo error]:', err);
    res.status(404).end();
  }
});

// Standalone File Upload endpoint for picture (Shrinks to 400x400 WebP data URL preview)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  try {
    const buf = await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();
    const dataUrl = `data:image/webp;base64,${buf.toString('base64')}`;
    return res.json({ success: true, url: dataUrl });
  } catch (err) {
    console.error('[upload error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
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
    const pictureResolved = await resolvePictureUrl(member.picture, member.id);
    const cardBuffer = await generateBirthdayCard({
      name: member.name,
      designation: member.designation,
      picture: pictureResolved,
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
