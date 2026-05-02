import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;

    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (!email && !phone) return res.status(400).json({ error: 'Email or phone is required' });

    const user = await prisma.user.findFirst({
      where: email ? { email } : { phone },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact your administrator.' });
    }
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Please set your password first using the invite link.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/set-password', async (req, res, next) => {
  try {
    const { inviteToken, password, confirmPassword } = req.body;

    if (!inviteToken) return res.status(400).json({ error: 'Invite token is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

    const user = await prisma.user.findUnique({ where: { inviteToken } });
    if (!user) return res.status(404).json({ error: 'Invalid or expired invite link' });
    if (user.status === 'ACTIVE') return res.status(400).json({ error: 'This invite has already been used' });

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, status: 'ACTIVE', inviteToken: null },
    });

    res.json({ message: 'Password set successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
    if (!newPassword)     return res.status(400).json({ error: 'New password is required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true },
    });

    const valid = user?.passwordHash && await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;