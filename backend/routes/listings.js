// backend/routes/listings.js
const express  = require('express');
const { query, getClient } = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadMultiple, processUploadedFiles } = require('../middleware/imageHandler');

const router = express.Router();

// ── GET /api/listings ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const { type, lat, lng, radius = 50, maxRent, minArea, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conds  = ['l.is_available = TRUE'];

  if (type)    { params.push(type);       conds.push(`l.type = $${params.length}`); }
  if (maxRent) { params.push(+maxRent);   conds.push(`l.rent <= $${params.length}`); }
  if (minArea) { params.push(+minArea);   conds.push(`l.area >= $${params.length}`); }

  let distSel = '', orderBy = 'l.created_at DESC';
  if (lat && lng) {
    const [lf, lgf, rf] = [parseFloat(lat), parseFloat(lng), parseFloat(radius)];
    const delta = rf / 111.0;
    distSel = `, ROUND((6371 * acos(LEAST(1,
      cos(radians(${lf})) * cos(radians(l.lat))
      * cos(radians(l.lng) - radians(${lgf}))
      + sin(radians(${lf})) * sin(radians(l.lat))
    )))::numeric, 1) AS distance_km`;
    conds.push(`l.lat BETWEEN ${lf - delta} AND ${lf + delta}`);
    conds.push(`l.lng BETWEEN ${lgf - delta} AND ${lgf + delta}`);
    orderBy = 'distance_km ASC';
  }

  const where = `WHERE ${conds.join(' AND ')}`;
  try {
    params.push(parseInt(limit), offset);
    const result = await query(`
      SELECT l.id, l.type, l.title, l.area, l.area_unit, l.rent, l.rent_per,
             l.amenities, l.description, l.address, l.lat, l.lng,
             l.min_duration, l.created_at ${distSel},
             u.id AS owner_id, u.name AS owner_name, u.trust_score,
             (SELECT id FROM listing_images li
              WHERE li.listing_id = l.id ORDER BY sort_order LIMIT 1
             ) AS thumbnail_image_id
      FROM listings l
      JOIN users u ON u.id = l.owner_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const listings = result.rows.map(r => ({
      ...r,
      thumbnail_url: r.thumbnail_image_id
        ? `/api/images/listing/${r.thumbnail_image_id}`
        : null,
    }));
    res.json({ listings });
  } catch (err) {
    console.error('Listings fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// ── GET /api/listings/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  const result = await query(`
    SELECT l.*,
      u.id AS owner_id, u.name AS owner_name,
      u.phone AS owner_phone, u.trust_score, u.review_count,
      COALESCE(
        json_agg(
          json_build_object(
            'id', li.id,
            'url', '/api/images/listing/' || li.id::text,
            'width', li.width, 'height', li.height
          ) ORDER BY li.sort_order
        ) FILTER (WHERE li.id IS NOT NULL), '[]'
      ) AS images
    FROM listings l
    JOIN users u ON u.id = l.owner_id
    LEFT JOIN listing_images li ON li.listing_id = l.id
    WHERE l.id = $1
    GROUP BY l.id, u.id
  `, [req.params.id]);

  if (!result.rows.length)
    return res.status(404).json({ error: 'Listing not found' });
  res.json({ listing: result.rows[0] });
});

// ── POST /api/listings (create + images) ─────────────────────
router.post(
  '/',
  protect,
  restrictTo('farmer', 'both'),
  uploadMultiple.array('images', 5),
  processUploadedFiles,
  async (req, res) => {
    const {
      type, title, area, area_unit = 'acres',
      rent, rent_per = 'month', amenities = '[]',
      description, address, lat, lng, min_duration = 1,
    } = req.body;

    if (!type || !title || !area || !rent || !lat || !lng)
      return res.status(400).json({ error: 'type, title, area, rent, lat, lng are required' });

    let amenitiesArr = [];
    try { amenitiesArr = JSON.parse(amenities); } catch (_) {}

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const res2 = await client.query(`
        INSERT INTO listings
          (owner_id, type, title, area, area_unit, rent, rent_per,
           amenities, description, address, lat, lng, min_duration)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `, [req.user.id, type, title, parseFloat(area), area_unit,
          parseFloat(rent), rent_per, amenitiesArr,
          description || null, address || null,
          parseFloat(lat), parseFloat(lng), parseInt(min_duration)]);

      const listing  = res2.rows[0];
      const imageIds = [];

      if (req.processedImages?.length) {
        for (let i = 0; i < req.processedImages.length; i++) {
          const img = req.processedImages[i];
          const imgRes = await client.query(`
            INSERT INTO listing_images
              (listing_id, image_data, mime_type, width, height, size_bytes, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING id
          `, [listing.id, img.data, img.mimeType, img.width, img.height, img.sizeBytes, i]);
          imageIds.push(imgRes.rows[0].id);
        }
      }

      await client.query('COMMIT');
      res.status(201).json({
        listing: {
          ...listing,
          images: imageIds.map((id, i) => ({
            id, url: `/api/images/listing/${id}`, sort_order: i,
          })),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create listing error:', err);
      res.status(500).json({ error: 'Failed to create listing' });
    } finally {
      client.release();
    }
  }
);

// ── PUT /api/listings/:id ─────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  const own = await query(
    'SELECT id FROM listings WHERE id = $1 AND owner_id = $2',
    [req.params.id, req.user.id]
  );
  if (!own.rows.length) return res.status(403).json({ error: 'Not authorized' });

  const { title, area, rent, description, amenities, is_available, address } = req.body;
  const result = await query(`
    UPDATE listings SET
      title       = COALESCE($1, title),
      area        = COALESCE($2, area),
      rent        = COALESCE($3, rent),
      description = COALESCE($4, description),
      amenities   = COALESCE($5, amenities),
      is_available= COALESCE($6, is_available),
      address     = COALESCE($7, address)
    WHERE id = $8 RETURNING *
  `, [title, area, rent, description, amenities, is_available, address, req.params.id]);

  res.json({ listing: result.rows[0] });
});

// ── DELETE /api/listings/:id ──────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  const result = await query(
    'UPDATE listings SET is_available = FALSE WHERE id = $1 AND owner_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(403).json({ error: 'Not authorized' });
  res.json({ message: 'Listing removed', id: req.params.id });
});

module.exports = router;
