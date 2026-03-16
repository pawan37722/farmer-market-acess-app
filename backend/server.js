// backend/server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { pool } = require('./config/db');

const authRoutes        = require('./routes/auth');
const cropRoutes        = require('./routes/crops');
const listingRoutes     = require('./routes/listings');
const serviceRoutes     = require('./routes/services');
const transactionRoutes = require('./routes/transactions');
const userRoutes        = require('./routes/users');
const imageRoutes       = require('./routes/images');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Core middleware ───────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/crops',        cropRoutes);
app.use('/api/listings',     listingRoutes);
app.use('/api/services',     serviceRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/images',       imageRoutes);   // serves images from DB as binary

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: `File too large. Max ${process.env.MAX_IMAGE_SIZE_MB || 8}MB.` });
  if (err.message?.includes('File type not allowed'))
    return res.status(415).json({ error: err.message });
  console.error('❌ Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AgriApp backend running on http://localhost:${PORT}`);
  console.log(`📸 Images served at: http://localhost:${PORT}/api/images/:type/:id`);
  console.log(`🌿 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
