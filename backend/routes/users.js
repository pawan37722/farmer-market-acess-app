// backend/routes/users.js
const express   = require('express');
const { query } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/users/:id/profile ────────────────────────────────
router.get('/:id/profile', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id, u.name, u.role, u.address, u.lat, u.lng,
        u.trust_score, u.completed_transactions,
        u.review_count, u.is_verified, u.created_at,
        (SELECT COUNT(*) FROM crops    WHERE farmer_id = u.id AND is_active    = TRUE) AS active_crops,
        (SELECT COUNT(*) FROM listings WHERE owner_id  = u.id AND is_available = TRUE) AS active_listings,
        (SELECT COUNT(*) FROM services WHERE provider_id = u.id AND is_active  = TRUE) AS active_services,
        (SELECT id FROM user_avatars WHERE user_id = u.id LIMIT 1) AS has_avatar,
        COALESCE((
          SELECT json_agg(row ORDER BY row.created_at DESC)
          FROM (
            SELECT r.rating, r.comment, r.role, r.created_at,
                   rv.name AS reviewer_name
            FROM reviews r
            JOIN users rv ON rv.id = r.reviewer_id
            WHERE r.reviewee_id = u.id
            ORDER BY r.created_at DESC
            LIMIT 5
          ) row
        ), '[]') AS recent_reviews
      FROM users u
      WHERE u.id = $1
    `, [req.params.id]);

    if (!result.rows.length)
      return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    user.avatar_url = user.has_avatar
      ? `/api/images/avatar/${user.id}`
      : null;
    delete user.has_avatar;

    res.json({ user });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── GET /api/users/:id/trust ──────────────────────────────────
router.get('/:id/trust', async (req, res) => {
  const result = await query(
    'SELECT trust_score, review_count, completed_transactions FROM users WHERE id = $1',
    [req.params.id]
  );
  if (!result.rows.length)
    return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

// ── PATCH /api/users/me ───────────────────────────────────────
router.patch('/me', protect, async (req, res) => {
  const { name, email, address, lat, lng } = req.body;

  const result = await query(`
    UPDATE users SET
      name    = COALESCE($1, name),
      email   = COALESCE($2, email),
      address = COALESCE($3, address),
      lat     = COALESCE($4, lat),
      lng     = COALESCE($5, lng)
    WHERE id = $6
    RETURNING id, name, email, role, address, lat, lng, trust_score
  `, [name, email, address, lat, lng, req.user.id]);

  const user = result.rows[0];
  const avatar = await query(
    'SELECT id FROM user_avatars WHERE user_id = $1', [user.id]
  );
  user.avatar_url = avatar.rows.length
    ? `/api/images/avatar/${user.id}`
    : null;

  res.json({ user });
});

module.exports = router;
