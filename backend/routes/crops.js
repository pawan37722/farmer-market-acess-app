// backend/routes/crops.js
const express  = require('express');
const { query, getClient } = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadMultiple, processUploadedFiles } = require('../middleware/imageHandler');

const router = express.Router();

// ── Haversine distance in SQL (no PostGIS needed) ─────────────────────────────
const haversine = (lat, lng) => `
  ROUND((6371 * acos(LEAST(1,
    cos(radians(${lat})) * cos(radians(c.lat))
    * cos(radians(c.lng) - radians(${lng}))
    + sin(radians(${lat})) * sin(radians(c.lat))
  )))::numeric, 1)
`;

// ── GET /api/crops ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const {
    search, category, lat, lng, radius = 50,
    minPrice, maxPrice, page = 1, limit = 20,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conds  = ['c.is_active = TRUE'];

  if (search)   { params.push(`%${search}%`); conds.push(`c.name ILIKE $${params.length}`); }
  if (category) { params.push(category);       conds.push(`c.category = $${params.length}`); }
  if (minPrice) { params.push(+minPrice);       conds.push(`c.price >= $${params.length}`); }
  if (maxPrice) { params.push(+maxPrice);       conds.push(`c.price <= $${params.length}`); }

  let distSel = '', orderBy = 'c.created_at DESC';
  if (lat && lng) {
    const [lf, lgf, rf] = [parseFloat(lat), parseFloat(lng), parseFloat(radius)];
    const delta = rf / 111.0;
    distSel  = `, ${haversine(lf, lgf)} AS distance_km`;
    conds.push(`c.lat BETWEEN ${lf - delta} AND ${lf + delta}`);
    conds.push(`c.lng BETWEEN ${lgf - delta} AND ${lgf + delta}`);
    orderBy  = 'distance_km ASC';
  }

  const where = `WHERE ${conds.join(' AND ')}`;

  try {
    const countRes = await query(`SELECT COUNT(*) FROM crops c ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(`
      SELECT
        c.id, c.name, c.category, c.price, c.unit, c.quantity,
        c.description, c.harvest_date, c.address, c.lat, c.lng,
        c.views, c.created_at ${distSel},
        u.id   AS farmer_id,
        u.name AS farmer_name,
        u.trust_score AS farmer_trust,
        -- Return first image ID so mobile can build the URL
        (SELECT id FROM crop_images ci
         WHERE ci.crop_id = c.id
         ORDER BY sort_order LIMIT 1) AS thumbnail_image_id,
        (SELECT COUNT(*) FROM crop_images ci WHERE ci.crop_id = c.id) AS image_count
      FROM crops c
      JOIN users u ON u.id = c.farmer_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Build thumbnail URL from image id
    const crops = result.rows.map(row => ({
      ...row,
      thumbnail_url: row.thumbnail_image_id
        ? `/api/images/crop/${row.thumbnail_image_id}`
        : null,
    }));

    res.json({
      crops,
      pagination: {
        total, page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Crops fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch crops' });
  }
});

// ── GET /api/crops/my ─────────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  const result = await query(`
    SELECT c.*,
      (SELECT id FROM crop_images ci WHERE ci.crop_id = c.id ORDER BY sort_order LIMIT 1) AS thumbnail_image_id,
      (SELECT COUNT(*) FROM crop_images ci WHERE ci.crop_id = c.id) AS image_count
    FROM crops c
    WHERE c.farmer_id = $1
    ORDER BY c.created_at DESC
  `, [req.user.id]);

  const crops = result.rows.map(r => ({
    ...r,
    thumbnail_url: r.thumbnail_image_id
      ? `/api/images/crop/${r.thumbnail_image_id}`
      : null,
  }));
  res.json({ crops });
});

// ── GET /api/crops/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const client = await getClient();
  try {
    await client.query('UPDATE crops SET views = views + 1 WHERE id = $1', [req.params.id]);
    const result = await client.query(`
      SELECT c.*,
        u.id AS farmer_id, u.name AS farmer_name, u.phone AS farmer_phone,
        u.trust_score, u.completed_transactions, u.review_count,
        -- Return all image IDs as array
        COALESCE(
          json_agg(
            json_build_object('id', ci.id, 'url', '/api/images/crop/' || ci.id::text,
                              'width', ci.width, 'height', ci.height)
            ORDER BY ci.sort_order
          ) FILTER (WHERE ci.id IS NOT NULL), '[]'
        ) AS images
      FROM crops c
      JOIN users u ON u.id = c.farmer_id
      LEFT JOIN crop_images ci ON ci.crop_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, u.id
    `, [req.params.id]);

    if (!result.rows.length)
      return res.status(404).json({ error: 'Crop not found' });

    res.json({ crop: result.rows[0] });
  } finally {
    client.release();
  }
});

// ── POST /api/crops (create + upload images) ──────────────────
router.post(
  '/',
  protect,
  restrictTo('farmer', 'both'),
  uploadMultiple.array('images', 5),
  processUploadedFiles,
  async (req, res) => {
    const {
      name, category, price, unit = 'kg', quantity,
      description, harvest_date, address, lat, lng,
    } = req.body;

    if (!name || !category || !price || !quantity || !lat || !lng)
      return res.status(400).json({ error: 'name, category, price, quantity, lat, lng are required' });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Insert crop row
      const cropRes = await client.query(`
        INSERT INTO crops
          (farmer_id, name, category, price, unit, quantity,
           description, harvest_date, address, lat, lng)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `, [req.user.id, name, category, parseFloat(price), unit, parseFloat(quantity),
          description || null, harvest_date || null, address || null,
          parseFloat(lat), parseFloat(lng)]);

      const crop = cropRes.rows[0];

      // 2. Insert image rows (BYTEA data from processedImages)
      const imageIds = [];
      if (req.processedImages?.length) {
        for (let i = 0; i < req.processedImages.length; i++) {
          const img = req.processedImages[i];
          const imgRes = await client.query(`
            INSERT INTO crop_images
              (crop_id, image_data, mime_type, width, height, size_bytes, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING id
          `, [crop.id, img.data, img.mimeType, img.width, img.height, img.sizeBytes, i]);
          imageIds.push(imgRes.rows[0].id);
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        crop: {
          ...crop,
          image_count: imageIds.length,
          images: imageIds.map((id, i) => ({
            id,
            url: `/api/images/crop/${id}`,
            sort_order: i,
          })),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create crop error:', err);
      res.status(500).json({ error: 'Failed to create crop listing' });
    } finally {
      client.release();
    }
  }
);

// ── PUT /api/crops/:id ────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  const own = await query(
    'SELECT id FROM crops WHERE id = $1 AND farmer_id = $2',
    [req.params.id, req.user.id]
  );
  if (!own.rows.length)
    return res.status(403).json({ error: 'Not authorized or crop not found' });

  const { name, category, price, unit, quantity, description, harvest_date, address, lat, lng, is_active } = req.body;

  const result = await query(`
    UPDATE crops SET
      name         = COALESCE($1, name),
      category     = COALESCE($2, category),
      price        = COALESCE($3, price),
      unit         = COALESCE($4, unit),
      quantity     = COALESCE($5, quantity),
      description  = COALESCE($6, description),
      harvest_date = COALESCE($7, harvest_date),
      address      = COALESCE($8, address),
      lat          = COALESCE($9, lat),
      lng          = COALESCE($10, lng),
      is_active    = COALESCE($11, is_active)
    WHERE id = $12
    RETURNING *
  `, [name, category, price, unit, quantity, description,
      harvest_date, address, lat, lng, is_active, req.params.id]);

  res.json({ crop: result.rows[0] });
});

// ── DELETE /api/crops/:id (soft delete) ───────────────────────
router.delete('/:id', protect, async (req, res) => {
  const result = await query(
    'UPDATE crops SET is_active = FALSE WHERE id = $1 AND farmer_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (!result.rows.length)
    return res.status(403).json({ error: 'Not authorized or crop not found' });
  res.json({ message: 'Crop deactivated', id: req.params.id });
});

module.exports = router;
