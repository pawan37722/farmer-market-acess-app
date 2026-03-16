// backend/routes/transactions.js
const express = require('express');
const axios   = require('axios');
const { query, getClient } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/transactions/me ──────────────────────────────────
router.get('/me', protect, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [req.user.id, req.user.id];
  let statusFilter = '';

  if (status) {
    params.push(status);
    statusFilter = `AND t.status = $${params.length}`;
  }

  const result = await query(`
    SELECT t.*,
      buyer.name  AS buyer_name,
      seller.name AS seller_name,
      (SELECT rating FROM reviews
       WHERE transaction_id = t.id AND reviewer_id = $1
       LIMIT 1) AS my_rating
    FROM transactions t
    JOIN users buyer  ON buyer.id  = t.buyer_id
    JOIN users seller ON seller.id = t.seller_id
    WHERE (t.buyer_id = $1 OR t.seller_id = $2) ${statusFilter}
    ORDER BY t.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, parseInt(limit), offset]);

  res.json({ transactions: result.rows });
});

// ── POST /api/transactions ────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { seller_id, item_id, item_type, quantity, amount, notes } = req.body;

  if (!seller_id || !item_id || !item_type || !amount)
    return res.status(400).json({ error: 'seller_id, item_id, item_type, amount are required' });
  if (seller_id === req.user.id)
    return res.status(400).json({ error: 'Cannot transact with yourself' });

  const result = await query(`
    INSERT INTO transactions (buyer_id, seller_id, item_id, item_type, quantity, amount, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [req.user.id, seller_id, item_id, item_type,
      quantity || null, parseFloat(amount), notes || null]);

  res.status(201).json({ transaction: result.rows[0] });
});

// ── PATCH /api/transactions/:id/status ───────────────────────
router.patch('/:id/status', protect, async (req, res) => {
  const { status } = req.body;
  const allowed = ['confirmed', 'visited', 'completed', 'disputed', 'cancelled'];

  if (!allowed.includes(status))
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

  const txRes = await query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
  if (!txRes.rows.length)
    return res.status(404).json({ error: 'Transaction not found' });

  const tx = txRes.rows[0];
  if (tx.buyer_id !== req.user.id && tx.seller_id !== req.user.id)
    return res.status(403).json({ error: 'Not authorized' });

  const completedAt = status === 'completed' ? ', completed_at = NOW()' : '';

  const result = await query(`
    UPDATE transactions
    SET status = $1 ${completedAt}
    WHERE id = $2
    RETURNING *
  `, [status, req.params.id]);

  if (status === 'completed') {
    await query(
      'UPDATE users SET completed_transactions = completed_transactions + 1 WHERE id = $1',
      [tx.seller_id]
    );
  }

  res.json({ transaction: result.rows[0] });
});

// ── POST /api/transactions/:id/review ────────────────────────
router.post('/:id/review', protect, async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'rating must be between 1 and 5' });

  const txRes = await query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
  if (!txRes.rows.length)
    return res.status(404).json({ error: 'Transaction not found' });

  const tx = txRes.rows[0];
  if (tx.status !== 'completed')
    return res.status(400).json({ error: 'Can only review completed transactions' });

  const isBuyer    = tx.buyer_id  === req.user.id;
  const isSeller   = tx.seller_id === req.user.id;
  if (!isBuyer && !isSeller)
    return res.status(403).json({ error: 'Not authorized' });

  const revieweeId = isBuyer ? tx.seller_id : tx.buyer_id;
  const role       = isBuyer ? 'buyer' : 'seller';

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const reviewRes = await client.query(`
      INSERT INTO reviews (transaction_id, reviewer_id, reviewee_id, rating, comment, role)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (transaction_id, reviewer_id) DO NOTHING
      RETURNING *
    `, [tx.id, req.user.id, revieweeId, parseInt(rating), comment || null, role]);

    if (!reviewRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Already reviewed this transaction' });
    }

    await client.query(`
      UPDATE users
      SET total_review_score = total_review_score + $1,
          review_count = review_count + 1
      WHERE id = $2
    `, [parseInt(rating), revieweeId]);

    // Trigger AI trust recalculation
    try {
      await recalcTrustScore(revieweeId, client);
    } catch (aiErr) {
      console.warn('AI service unavailable — trust score not updated:', aiErr.message);
    }

    await client.query('COMMIT');
    res.status(201).json({ review: reviewRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  } finally {
    client.release();
  }
});

// ── Trust score recalculation via Python AI ───────────────────
async function recalcTrustScore(userId, client) {
  const result = await client.query(`
    SELECT r.rating, t.status
    FROM reviews r
    JOIN transactions t ON t.id = r.transaction_id
    WHERE r.reviewee_id = $1
  `, [userId]);

  if (!result.rows.length) return;

  const reviews = result.rows.map(row => ({
    rating:    parseFloat(row.rating),
    completed: row.status === 'completed',
  }));

  const { data } = await axios.post(
    `${process.env.AI_SERVICE_URL}/calculate-trust`,
    { user_id: userId, reviews }
  );

  await client.query(
    'UPDATE users SET trust_score = $1 WHERE id = $2',
    [data.trust_score, userId]
  );
}

module.exports = router;
