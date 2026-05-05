import { Router } from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.max(1, parseInt(req.query.limit) || 15);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);

    // Fetch all records to group by phone — dataset is manageable
    const allRecords = await prisma.customer.findMany({
      select: {
        name:       true,
        phone:      true,
        shipmentId: true,
        delivered:  true,
        createdAt:  true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by phone number; first record per phone is the most recent (desc order)
    const groupMap = new Map();
    for (const c of allRecords) {
      if (!groupMap.has(c.phone)) {
        groupMap.set(c.phone, {
          name:           c.name,
          phone:          c.phone,
          lastShipmentId: c.shipmentId,
          shipmentIds:    [],
          totalItems:     0,
          allDelivered:   true,
        });
      }
      const g = groupMap.get(c.phone);
      g.shipmentIds.push(c.shipmentId);
      g.totalItems += c._count.items;
      if (!c.delivered) g.allDelivered = false;
    }

    // Sort alphabetically by name
    const distinct = Array.from(groupMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const total          = distinct.length;
    const totalItems     = distinct.reduce((s, g) => s + g.totalItems, 0);
    const deliveredCount = distinct.filter(g => g.allDelivered).length;
    const pendingCount   = total - deliveredCount;
    const totalPages     = Math.max(1, Math.ceil(total / limit));

    const pageSlice = distinct.slice((page - 1) * limit, page * limit).map(g => ({
      phone:          g.phone,
      name:           g.name,
      shipmentCount:  g.shipmentIds.length,
      totalItems:     g.totalItems,
      shipmentIds:    g.shipmentIds,
      lastShipmentId: g.lastShipmentId,
    }));

    console.log(`[GET /customers] raw records: ${allRecords.length}, distinct: ${total}, page: ${page}/${totalPages}, slice: ${pageSlice.length}`);

    res.json({ customers: pageSlice, total, page, totalPages, totalItems, deliveredCount, pendingCount });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, shipmentId, items } = req.body;

    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    if (!shipmentId) return res.status(400).json({ error: 'Shipment ID is required' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    // Auto-generate a safe unique tracking ID based on existing IDs for this shipment
    const prefix = shipmentId + '-T';
    const existing = await prisma.customer.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    });
    let highest = 0;
    for (const c of existing) {
      const num = parseInt(c.id.slice(prefix.length), 10);
      if (!isNaN(num) && num > highest) highest = num;
    }
    const id = prefix + String(highest + 1).padStart(4, '0');

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
  console.log('[PATCH /deliver] id:', req.params.id);
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