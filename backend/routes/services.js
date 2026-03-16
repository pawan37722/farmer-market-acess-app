// backend/routes/services.js
const express  = require('express');
const { query, getClient } = require('../config/db');
const { protect } = require('../middleware/auth');
const { uploadMultiple, processUploadedFiles } = require('../middleware/imageHandler');

const router = express.Router();

// ── GET /api/services ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const { category, lat, lng, radius = 100, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conds  = ['s.is_active = TRUE'];

  if (category) { params.push(category); conds.push(`s.category = $${params.length}`); }

  let distSel = '', orderBy = 's.created_at DESC';
  if (lat && lng) {
    const [lf, lgf, rf] = [parseFloat(lat), parseFloat(lng), parseFloat(radius)];
    const delta = rf / 111.0;
    distSel = `, ROUND((6371 * acos(LEAST(1,
      cos(radians(${lf})) * cos(radians(s.lat))
      * cos(radians(s.lng) - radians(${lgf}))
      + sin(radians(${lf})) * sin(radians(s.lat))
    )))::numeric, 1) AS distance_km`;
    conds.push(`s.lat BETWEEN ${lf - delta} AND ${lf + delta}`);
    conds.push(`s.lng BETWEEN ${lgf - delta} AND ${lgf + delta}`);
    orderBy = 'distance_km ASC';
  }

  const where = `WHERE ${conds.join(' AND ')}`;
  try {
    params.push(parseInt(limit), offset);
    const result = await query(`
      SELECT s.id, s.name, s.category, s.price, s.price_per,
             s.description, s.address, s.lat, s.lng,
             s.image_count, s.created_at ${distSel},
             u.id AS provider_id, u.name AS provider_name, u.trust_score,
             (SELECT id FROM service_images si
              WHERE si.service_id = s.id ORDER BY sort_order LIMIT 1
             ) AS thumbnail_image_id
      FROM services s
      JOIN users u ON u.id = s.provider_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const services = result.rows.map(r => ({
      ...r,
      thumbnail_url: r.thumbnail_image_id
        ? `/api/images/service/${r.thumbnail_image_id}`
        : null,
    }));
    res.json({ services });
  } catch (err) {
    console.error('Services fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// ── GET /api/services/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  const result = await query(`
    SELECT s.*,
      u.id AS provider_id, u.name AS provider_name,
      u.phone AS provider_phone, u.trust_score, u.review_count,
      COALESCE(
        json_agg(
          json_build_object(
            'id', si.id,
            'url', '/api/images/service/' || si.id::text,
            'width', si.width, 'height', si.height,
            'sort_order', si.sort_order
          ) ORDER BY si.sort_order
        ) FILTER (WHERE si.id IS NOT NULL), '[]'
      ) AS images
    FROM services s
    JOIN users u ON u.id = s.provider_id
    LEFT JOIN service_images si ON si.service_id = s.id
    WHERE s.id = $1
    GROUP BY s.id, u.id
  `, [req.params.id]);

  if (!result.rows.length)
    return res.status(404).json({ error: 'Service not found' });
  res.json({ service: result.rows[0] });
});

// ── POST /api/services (create + images) ─────────────────────
router.post(
  '/',
  protect,
  uploadMultiple.array('images', 5),
  processUploadedFiles,
  async (req, res) => {
    const {
      name, category, price, price_per = 'day',
      description, address, lat, lng,
    } = req.body;

    if (!name || !category || !price)
      return res.status(400).json({ error: 'name, category, price are required' });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const svcRes = await client.query(`
        INSERT INTO services
          (provider_id, name, category, price, price_per,
           description, address, lat, lng, image_count)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
      `, [req.user.id, name, category, parseFloat(price), price_per,
          description || null, address || null,
          lat ? parseFloat(lat) : null,
          lng ? parseFloat(lng) : null,
          req.processedImages?.length || 0]);

      const service  = svcRes.rows[0];
      const imageIds = [];

      if (req.processedImages?.length) {
        for (let i = 0; i < req.processedImages.length; i++) {
          const img = req.processedImages[i];
          const imgRes = await client.query(`
            INSERT INTO service_images
              (service_id, image_data, mime_type, original_name,
               width, height, size_bytes, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING id
          `, [service.id, img.data, img.mimeType, img.originalName,
              img.width, img.height, img.sizeBytes, i]);
          imageIds.push(imgRes.rows[0].id);
        }
      }

      await client.query('COMMIT');
      res.status(201).json({
        service: {
          ...service,
          images: imageIds.map((id, i) => ({
            id,
            url: `/api/images/service/${id}`,
            sort_order: i,
          })),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create service error:', err);
      res.status(500).json({ error: 'Failed to create service' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/services/:id/book ───────────────────────────────
router.post('/:id/book', protect, async (req, res) => {
  const { quantity = 1, notes } = req.body;
  const svc = await query(
    'SELECT * FROM services WHERE id = $1 AND is_active = TRUE',
    [req.params.id]
  );
  if (!svc.rows.length)
    return res.status(404).json({ error: 'Service not found' });
  if (svc.rows[0].provider_id === req.user.id)
    return res.status(400).json({ error: 'Cannot book your own service' });

  const amount = svc.rows[0].price * quantity;
  const result = await query(`
    INSERT INTO transactions
      (buyer_id, seller_id, item_id, item_type, quantity, amount, notes)
    VALUES ($1,$2,$3,'service',$4,$5,$6)
    RETURNING *
  `, [req.user.id, svc.rows[0].provider_id, svc.rows[0].id,
      quantity, amount, notes || null]);

  res.status(201).json({ transaction: result.rows[0] });
});

// ── PUT /api/services/:id ─────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  const own = await query(
    'SELECT id FROM services WHERE id = $1 AND provider_id = $2',
    [req.params.id, req.user.id]
  );
  if (!own.rows.length)
    return res.status(403).json({ error: 'Not authorized' });

  const { name, category, price, price_per, description, address, is_active } = req.body;
  const result = await query(`
    UPDATE services SET
      name        = COALESCE($1, name),
      category    = COALESCE($2, category),
      price       = COALESCE($3, price),
      price_per   = COALESCE($4, price_per),
      description = COALESCE($5, description),
      address     = COALESCE($6, address),
      is_active   = COALESCE($7, is_active)
    WHERE id = $8 RETURNING *
  `, [name, category, price, price_per, description, address, is_active, req.params.id]);

  res.json({ service: result.rows[0] });
});

module.exports = router;
