// backend/routes/auth.js
const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { query, getClient } = require('../config/db');
const { protect } = require('../middleware/auth');
const { uploadSingle, processUploadedFile } = require('../middleware/imageHandler');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, phone, password, role = 'buyer', email, address, lat, lng } = req.body;

  if (!name || !phone || !password)
    return res.status(400).json({ error: 'name, phone and password are required' });

  try {
    const exists = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (exists.rows.length)
      return res.status(409).json({ error: 'Phone number already registered' });

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (name, phone, email, role, address, lat, lng, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, phone, role, trust_score, created_at`,
      [name, phone, email || null, role, address || null,
       lat || null, lng || null, passwordHash]
    );

    const user  = result.rows[0];
    const token = signToken(user.id);
    res.status(201).json({ status: 'success', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password)
    return res.status(400).json({ error: 'phone and password are required' });

  try {
    const result = await query(
      'SELECT id, name, phone, role, password_hash, trust_score FROM users WHERE phone = $1',
      [phone]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: 'Invalid phone or password' });

    const user  = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid phone or password' });

    delete user.password_hash;
    const token = signToken(user.id);

    // Check if user has avatar
    const avatar = await query(
      'SELECT id FROM user_avatars WHERE user_id = $1', [user.id]
    );
    user.avatar_url = avatar.rows.length
      ? `/api/images/avatar/${user.id}`
      : null;

    res.json({ status: 'success', token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  const result = await query(
    `SELECT id, name, phone, email, role, address, lat, lng,
            trust_score, completed_transactions, review_count,
            is_verified, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  const user = result.rows[0];
  const avatar = await query(
    'SELECT id FROM user_avatars WHERE user_id = $1', [user.id]
  );
  user.avatar_url = avatar.rows.length
    ? `/api/images/avatar/${user.id}`
    : null;
  res.json({ user });
});

// ── POST /api/auth/avatar (upload profile picture) ───────────
router.post(
  '/avatar',
  protect,
  uploadSingle.single('avatar'),
  processUploadedFile,
  async (req, res) => {
    if (!req.processedImage)
      return res.status(400).json({ error: 'No image file received' });

    const { data, mimeType, width, height, sizeBytes } = req.processedImage;

    try {
      // Upsert — replace existing avatar if present
      await query(
        `INSERT INTO user_avatars (user_id, image_data, mime_type, width, height, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           image_data = EXCLUDED.image_data,
           mime_type  = EXCLUDED.mime_type,
           width      = EXCLUDED.width,
           height     = EXCLUDED.height,
           size_bytes = EXCLUDED.size_bytes,
           created_at = NOW()`,
        [req.user.id, data, mimeType, width, height, sizeBytes]
      );
      res.json({
        message:    'Avatar updated',
        avatar_url: `/api/images/avatar/${req.user.id}`,
        width, height, size_bytes: sizeBytes,
      });
    } catch (err) {
      console.error('Avatar upload error:', err);
      res.status(500).json({ error: 'Failed to save avatar' });
    }
  }
);

module.exports = router;
