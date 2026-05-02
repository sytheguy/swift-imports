export function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('\n❌  Error:', err.message);
    console.error(err.stack);
  } else {
    console.error(`❌  ${req.method} ${req.path} — ${err.message}`);
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with that value already exists',
      field: err.meta?.target,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
}