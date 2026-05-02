import { Router } from 'express';
import { prisma } from '../index.js';

const router = Router();

const STATUS_ORDER = [
  'IN_WAREHOUSE_CHINA', 'EN_ROUTE', 'ARRIVED_GHANA',
  'CLEARED_CUSTOMS', 'AT_WAREHOUSE_GHANA', 'OUT_FOR_DELIVERY', 'DELIVERED',
];

const STATUS_LABELS = {
  SEA: ['In Warehouse (China)', 'En Route (Sea)', 'Arrived in Ghana', 'Cleared Customs', 'At Warehouse (Ghana)', 'Out for Delivery', 'Delivered'],
  AIR: ['In Warehouse (China)', 'En Route (Air)', 'Arrived in Ghana', 'Cleared Customs', 'At Warehouse (Ghana)', 'Out for Delivery', 'Delivered'],
};

const STATUS_DESC = {
  SEA: [
    'Your shipment is at our China warehouse being prepared for shipping.',
    'Your shipment is sailing from China to Ghana.',
    'Your shipment has arrived in Ghana and is clearing customs.',
    'Your shipment has cleared customs.',
    'Your items are at our Ghana warehouse, ready for dispatch.',
    'Your items are out for delivery today!',
    'Your items have been delivered. Thank you!',
  ],
  AIR: [
    'Your shipment is at our China warehouse being prepared for air freight.',
    'Your shipment is in the air en route to Ghana.',
    'Your shipment has landed in Ghana and is clearing customs.',
    'Your shipment has cleared customs.',
    'Your items are at our Ghana warehouse, ready for dispatch.',
    'Your items are out for delivery today!',
    'Your items have been delivered. Thank you!',
  ],
};

const ETA_DAYS = { SEA: 50, AIR: 7 };

router.get('/track/:trackingNumber', async (req, res, next) => {
  try {
    const trackingNumber = req.params.trackingNumber.toUpperCase();

    const customer = await prisma.customer.findUnique({
      where: { id: trackingNumber },
      include: {
        items: {
          select: { description: true, category: true },
          orderBy: { createdAt: 'asc' },
        },
        shipment: {
          select: { id: true, type: true, status: true, enRouteDate: true },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Tracking number not found' });
    }

    const { shipment } = customer;
    const stageIndex = STATUS_ORDER.indexOf(shipment.status);
    const type = shipment.type;

    let eta = null;
    if (shipment.enRouteDate && stageIndex >= 1) {
      const etaDate = new Date(shipment.enRouteDate);
      etaDate.setDate(etaDate.getDate() + ETA_DAYS[type]);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diffDays = Math.round((etaDate - today) / 86400000);
      eta = {
        date: etaDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        daysLeft: diffDays,
        overdue: diffDays < 0,
        active: stageIndex === 1,
      };
    }

    const phone = customer.phone;
    const maskedPhone = phone.slice(0, 3) + '•'.repeat(Math.max(0, phone.length - 5)) + phone.slice(-2);

    res.json({
      tracking: customer.id,
      name: customer.name,
      maskedPhone,
      delivered: customer.delivered,
      shipment: {
        id: shipment.id,
        type,
        status: shipment.status,
        statusIndex: stageIndex,
        statusLabel: STATUS_LABELS[type][stageIndex],
        statusDesc: STATUS_DESC[type][stageIndex],
      },
      eta,
      items: customer.items.map(it => ({
        description: it.description,
        category: it.category,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;