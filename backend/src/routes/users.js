import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post('/invite', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, phone, role } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!email && !phone) return res.status(400).json({ error: 'Email or phone is required' });

    const inviteToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        role: role?.toUpperCase() || 'STAFF',
        status: 'PENDING',
        inviteToken,
      },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true },
    });

    const inviteLink = `${process.env.BACKOFFICE_URL || 'http://localhost:3000'}/set-password?token=${inviteToken}`;
    res.status(201).json({ user, inviteLink });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, phone, role } = req.body;
    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (role) data.role = role.toUpperCase();

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, phone: true, role: true, status: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    }
    if (req.params.id === req.user.id && status === 'INACTIVE') {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/resend-invite', requireAdmin, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.status !== 'PENDING') return res.status(400).json({ error: 'User has already set their password' });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({ where: { id: req.params.id }, data: { inviteToken } });

    const inviteLink = `${process.env.BACKOFFICE_URL || 'http://localhost:3000'}/set-password?token=${inviteToken}`;
    res.json({ message: 'Invite resent', inviteLink });
  } catch (err) {
    next(err);
  }
});

export default router;