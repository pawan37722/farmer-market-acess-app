// backend/routes/images.js
// Reads image BYTEA data from PostgreSQL and serves it as binary HTTP response.
// Usage:
//   GET /api/images/crop/:imageId
//   GET /api/images/service/:imageId
//   GET /api/images/listing/:imageId
//   GET /api/images/avatar/:userId

const express   = require('express');
const { query } = require('../config/db');

const router = express.Router();

// ── Helper: stream image from query result ────────────────────────────────────
const streamImage = (res, row) => {
  if (!row || !row.image_data) {
    return res.status(404).json({ error: 'Image not found' });
  }
  const buf = Buffer.isBuffer(row.image_data)
    ? row.image_data
    : Buffer.from(row.image_data);

  res.set({
    'Content-Type':  row.mime_type || 'image/jpeg',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=86400',   // cache 24h
    'X-Image-Width':  row.width  || '',
    'X-Image-Height': row.height || '',
  });
  res.send(buf);
};

// ── GET /api/images/crop/:imageId ─────────────────────────────────────────────
router.get('/crop/:imageId', async (req, res) => {
  try {
    const result = await query(
      'SELECT image_data, mime_type, width, height FROM crop_images WHERE id = $1',
      [req.params.imageId]
    );
    streamImage(res, result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// ── GET /api/images/service/:imageId ─────────────────────────────────────────
router.get('/service/:imageId', async (req, res) => {
  try {
    const result = await query(
      'SELECT image_data, mime_type, width, height FROM service_images WHERE id = $1',
      [req.params.imageId]
    );
    streamImage(res, result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// ── GET /api/images/listing/:imageId ─────────────────────────────────────────
router.get('/listing/:imageId', async (req, res) => {
  try {
    const result = await query(
      'SELECT image_data, mime_type, width, height FROM listing_images WHERE id = $1',
      [req.params.imageId]
    );
    streamImage(res, result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// ── GET /api/images/avatar/:userId ────────────────────────────────────────────
router.get('/avatar/:userId', async (req, res) => {
  try {
    const result = await query(
      'SELECT image_data, mime_type, width, height FROM user_avatars WHERE user_id = $1',
      [req.params.userId]
    );
    streamImage(res, result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch avatar' });
  }
});

// ── DELETE /api/images/crop/:imageId ─────────────────────────────────────────
const { protect } = require('../middleware/auth');

router.delete('/crop/:imageId', protect, async (req, res) => {
  // Only the crop's farmer can delete
  const result = await query(
    `DELETE FROM crop_images ci
     USING crops c
     WHERE ci.id = $1 AND ci.crop_id = c.id AND c.farmer_id = $2
     RETURNING ci.id`,
    [req.params.imageId, req.user.id]
  );
  if (!result.rows.length)
    return res.status(403).json({ error: 'Not authorized or image not found' });
  res.json({ message: 'Image deleted', id: req.params.imageId });
});

router.delete('/service/:imageId', protect, async (req, res) => {
  const result = await query(
    `DELETE FROM service_images si
     USING services s
     WHERE si.id = $1 AND si.service_id = s.id AND s.provider_id = $2
     RETURNING si.id`,
    [req.params.imageId, req.user.id]
  );
  if (!result.rows.length)
    return res.status(403).json({ error: 'Not authorized or image not found' });
  res.json({ message: 'Image deleted', id: req.params.imageId });
});

module.exports = router;
