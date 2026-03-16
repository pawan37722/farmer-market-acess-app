// backend/middleware/auth.js
const jwt       = require('jsonwebtoken');
const { query } = require('../config/db');

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, name, phone, role, trust_score FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: 'User no longer exists' });

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ error: 'Invalid token' });
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    next(err);
  }
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role) && req.user.role !== 'both')
    return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
  next();
};

module.exports = { protect, restrictTo };
