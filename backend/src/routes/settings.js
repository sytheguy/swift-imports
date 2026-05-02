import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.patch('/hubtel', requireAuth, requireAdmin, (req, res) => {
  res.json({ message: 'Hubtel credentials received — update your .env file to apply them' });
});

export default router;
