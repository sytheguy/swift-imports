import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true },
    });

    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.status === 'INACTIVE') return res.status(403).json({ error: 'Account deactivated' });
    if (user.status === 'PENDING') return res.status(403).json({ error: 'Account not yet activated' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired — please log in again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}