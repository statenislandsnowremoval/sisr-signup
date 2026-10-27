require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3847;
const DATA_FILE = path.join(__dirname, 'data', 'signups.json');
const OUTBOX_FILE = path.join(__dirname, 'data', 'email-outbox.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'snow2026';
const MAIL_TO = process.env.MAIL_TO || 'statenislandsnowremovals@gmail.com';
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@statenislandsnowremoval.local';

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Password']
  })
);
app.use(express.json({ limit: '1mb' }));
// Store app UI (Capacitor webDir). Admin UI stays under /admin from public/.
app.use(express.static(path.join(__dirname, 'www')));
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function ensureOutboxFile() {
  const dir = path.dirname(OUTBOX_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(OUTBOX_FILE)) fs.writeFileSync(OUTBOX_FILE, '[]', 'utf8');
}

function readSignups() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeSignups(signups) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(signups, null, 2), 'utf8');
}

function readOutbox() {
  ensureOutboxFile();
  try {
    const raw = fs.readFileSync(OUTBOX_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeOutbox(items) {
  ensureOutboxFile();
  fs.writeFileSync(OUTBOX_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function escapeCsv(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function formatSignupEmail(signup) {
  const when = signup.createdAt
    ? new Date(signup.createdAt).toLocaleString('en-US', {
        timeZone: 'America/New_York'
      }) + ' (America/New_York)'
    : String(signup.createdAt || '');

  const body = [
    'New winter contact signup — Staten Island Snow Removal',
    '',
    `Name: ${signup.name}`,
    `Address: ${signup.address}`,
    `Email: ${signup.email}`,
    `Phone: ${signup.phone}`,
    `Preferred contact: ${signup.preferredContact}`,
    `Service type: ${signup.serviceType}`,
    `Notes: ${signup.notes || '(none)'}`,
    `Submitted: ${when}`,
    `Signup ID: ${signup.id}`
  ].join('\n');

  return {
    subject: `New winter signup: ${signup.name}`,
    text: body
  };
}

function queueEmail(signup, reason) {
  ensureOutboxFile();
  const { subject, text } = formatSignupEmail(signup);
  const entry = {
    id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to: MAIL_TO,
    from: MAIL_FROM,
    subject,
    text,
    signupId: signup.id,
    queuedAt: new Date().toISOString(),
    reason: reason || 'SMTP not configured'
  };
  const outbox = readOutbox();
  outbox.push(entry);
  writeOutbox(outbox);
  console.warn(
    `[email] SMTP not configured — queued signup email to outbox (${OUTBOX_FILE}). ` +
      `Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and optional MAIL_FROM / MAIL_TO) to send live. ` +
      `Queued id: ${entry.id}`
  );
  return { ok: false, queued: true, outboxId: entry.id };
}

async function sendSignupEmail(signup) {
  const { subject, text } = formatSignupEmail(signup);

  if (!smtpConfigured()) {
    return queueEmail(signup, 'SMTP_HOST / SMTP_USER / SMTP_PASS missing');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to: MAIL_TO,
      subject,
      text,
      replyTo: signup.email
    });
    console.log(`[email] Sent signup notification to ${MAIL_TO} (messageId: ${info.messageId})`);
    return { ok: true, queued: false, messageId: info.messageId };
  } catch (err) {
    console.error('[email] Send failed, queueing to outbox:', err.message);
    return queueEmail(signup, `send failed: ${err.message}`);
  }
}

app.post('/api/signups', async (req, res) => {
  const {
    name,
    address,
    email,
    phone,
    preferredContact,
    serviceType,
    notes
  } = req.body || {};

  const errors = [];
  if (!name || !String(name).trim()) errors.push('Name is required');
  if (!address || !String(address).trim()) errors.push('Address is required');
  if (!email || !String(email).trim()) errors.push('Email is required');
  if (!phone || !String(phone).trim()) errors.push('Phone is required');
  if (!['Call', 'Text', 'Email'].includes(preferredContact)) {
    errors.push('Preferred contact method must be Call, Text, or Email');
  }
  if (!['Driveway', 'Sidewalk', 'Both'].includes(serviceType)) {
    errors.push('Service type must be Driveway, Sidewalk, or Both');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    errors.push('Email looks invalid');
  }

  if (errors.length) {
    return res.status(400).json({ ok: false, errors });
  }

  const signup = {
    id: `sisr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(name).trim(),
    address: String(address).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    preferredContact,
    serviceType,
    notes: notes ? String(notes).trim() : '',
    createdAt: new Date().toISOString()
  };

  const signups = readSignups();
  signups.push(signup);
  writeSignups(signups);

  const mail = await sendSignupEmail(signup);

  res.status(201).json({
    ok: true,
    signup,
    email: {
      sent: Boolean(mail.ok),
      queued: Boolean(mail.queued),
      to: MAIL_TO
    }
  });
});

app.get('/api/signups', (req, res) => {
  const password = req.headers['x-admin-password'] || req.query.password;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const signups = readSignups().slice().reverse();
  res.json({ ok: true, signups });
});

app.get('/api/signups/export.csv', (req, res) => {
  const password = req.headers['x-admin-password'] || req.query.password;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).send('Unauthorized');
  }
  const signups = readSignups();
  const headers = [
    'id',
    'createdAt',
    'name',
    'address',
    'email',
    'phone',
    'preferredContact',
    'serviceType',
    'notes'
  ];
  const lines = [headers.join(',')];
  for (const s of signups) {
    lines.push(headers.map((h) => escapeCsv(s[h])).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="sisr-signups.csv"'
  );
  res.send(lines.join('\n'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  ensureDataFile();
  ensureOutboxFile();
  console.log(`Staten Island Snow Removal API/UI at http://localhost:${PORT}`);
  console.log(`Admin UI: http://localhost:${PORT}/admin`);
  console.log(`Signup emails → ${MAIL_TO}`);
  if (smtpConfigured()) {
    console.log(`[email] SMTP ready (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
  } else {
    console.warn(
      '[email] SMTP not configured — signups save locally and queue to data/email-outbox.json. ' +
        'Copy .env.example to .env and add a Gmail app password to send live.'
    );
  }
});
