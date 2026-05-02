import { Router } from 'express';
import { prisma } from '../index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/templates', async (req, res, next) => {
  try {
    const { type } = req.query;
    const templates = await prisma.notificationTemplate.findMany({
      where: type ? { type: type.toUpperCase() } : undefined,
      orderBy: [{ type: 'asc' }, { stage: 'asc' }],
    });
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

router.put('/templates', requireAdmin, async (req, res, next) => {
  try {
    const { type, templates } = req.body;
    if (!type) return res.status(400).json({ error: 'Type is required (SEA or AIR)' });
    if (!templates) return res.status(400).json({ error: 'Templates array is required' });

    const results = await Promise.all(
      templates.map(tpl =>
        prisma.notificationTemplate.upsert({
          where: { type_stage: { type: type.toUpperCase(), stage: tpl.stage } },
          update: { message: tpl.message },
          create: { type: type.toUpperCase(), stage: tpl.stage, message: tpl.message },
        })
      )
    );

    res.json({ saved: results.length, templates: results });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { shipmentId } = req.query;
    const logs = await prisma.notificationLog.findMany({
      where: shipmentId ? { customer: { shipmentId } } : undefined,
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;