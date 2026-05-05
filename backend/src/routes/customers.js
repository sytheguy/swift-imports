import { Router } from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.max(1, parseInt(req.query.limit) || 99999);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const skip  = (page - 1) * limit;

    const [pageCustomers, total, deliveredCount, totalItems] = await Promise.all([
      prisma.customer.findMany({
        include: {
          _count: { select: { items: true } },
          shipment: { select: { id: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count(),
      prisma.customer.count({ where: { delivered: true } }),
      prisma.item.count(),
    ]);

    res.json({
      customers: pageCustomers.map(c => ({
        id:           c.id,
        name:         c.name,
        phone:        c.phone,
        shipmentId:   c.shipmentId,
        shipmentType: c.shipment.type,
        delivered:    c.delivered,
        itemCount:    c._count.items,
        createdAt:    c.createdAt,
      })),
      total,
      page,
      totalPages:    Math.max(1, Math.ceil(total / limit)),
      totalItems,
      deliveredCount,
      pendingCount:  total - deliveredCount,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { id, name, phone, shipmentId, items } = req.body;

    if (!id) return res.status(400).json({ error: 'Tracking ID is required' });
    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    if (!shipmentId) return res.status(400).json({ error: 'Shipment ID is required' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    const customer = await prisma.customer.create({
      data: {
        id, name, phone, shipmentId,
        items: {
          create: items.map(it => ({
            description: it.desc || it.description,
            category: it.cat || it.category,
            otn: it.otn || null,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name, phone, items } = req.body;
    const customerId = req.params.id;

    const existing = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const customer = await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(name && { name }),
          ...(phone && { phone }),
        },
      });

      if (items && Array.isArray(items)) {
        await tx.item.deleteMany({ where: { customerId } });
        await tx.item.createMany({
          data: items.map(it => ({
            description: it.desc || it.description,
            category: it.cat || it.category,
            otn: it.otn || null,
            customerId,
          })),
        });
      }

      return tx.customer.findUnique({
        where: { id: customerId },
        include: { items: true },
      });
    });

    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ message: 'Customer removed from shipment' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/deliver', async (req, res, next) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { delivered: true },
    });

    const remaining = await prisma.customer.count({
      where: { shipmentId: customer.shipmentId, delivered: false },
    });

    if (remaining === 0) {
      await prisma.shipment.update({
        where: { id: customer.shipmentId },
        data: { status: 'DELIVERED' },
      });
    }

    res.json({ customer, shipmentCompleted: remaining === 0 });
  } catch (err) {
    next(err);
  }
});

export default router;