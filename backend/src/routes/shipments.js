import { Router } from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendStatusNotifications } from '../services/notifications.js';

const router = Router();
router.use(requireAuth);

const STATUS_ORDER = [
  'IN_WAREHOUSE_CHINA',
  'EN_ROUTE',
  'ARRIVED_GHANA',
  'CLEARED_CUSTOMS',
  'AT_WAREHOUSE_GHANA',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

router.get('/', async (req, res, next) => {
  try {
    const { type } = req.query;
    const shipments = await prisma.shipment.findMany({
      where: type ? { type: type.toUpperCase() } : undefined,
      orderBy: { date: 'desc' },
      include: { _count: { select: { customers: true } } },
    });

    res.json(shipments.map(s => ({
      id: s.id,
      type: s.type,
      status: s.status,
      statusIndex: STATUS_ORDER.indexOf(s.status),
      date: s.date,
      notes: s.notes,
      enRouteDate: s.enRouteDate,
      customerCount: s._count.customers,
      createdAt: s.createdAt,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { id, type, date, notes } = req.body;

    if (!id) return res.status(400).json({ error: 'Shipment ID is required' });
    if (!type) return res.status(400).json({ error: 'Shipment type is required (SEA or AIR)' });
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const shipment = await prisma.shipment.create({
      data: {
        id: id.toUpperCase(),
        type: type.toUpperCase(),
        date: new Date(date),
        notes: notes || null,
      },
    });

    res.status(201).json(shipment);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id.toUpperCase() },
      include: {
        customers: {
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    res.json({ ...shipment, statusIndex: STATUS_ORDER.indexOf(shipment.status) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { type, date, notes } = req.body;
    const id = req.params.id.toUpperCase();

    const data = {};
    if (type) data.type = type.toUpperCase();
    if (date) data.date = new Date(date);
    if (notes !== undefined) data.notes = notes || null;

    const shipment = await prisma.shipment.update({ where: { id }, data });
    res.json(shipment);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const id = req.params.id.toUpperCase();

    if (!STATUS_ORDER.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', allowed: STATUS_ORDER });
    }

    const data = { status };

    if (status === 'EN_ROUTE') {
      const existing = await prisma.shipment.findUnique({ where: { id } });
      if (!existing?.enRouteDate) {
        data.enRouteDate = new Date();
      }
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data,
      include: { customers: { include: { items: true } } },
    });

    sendStatusNotifications(shipment, STATUS_ORDER.indexOf(status)).catch(err =>
      console.error('Notification error:', err.message)
    );

    res.json({ ...shipment, statusIndex: STATUS_ORDER.indexOf(shipment.status) });
  } catch (err) {
    next(err);
  }
});

export default router;