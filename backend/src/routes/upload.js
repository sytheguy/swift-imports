import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'text/csv'
      || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || file.mimetype === 'application/vnd.ms-excel'
      || file.originalname.endsWith('.csv')
      || file.originalname.endsWith('.xlsx');
    ok ? cb(null, true) : cb(new Error('Only .csv and .xlsx files are accepted'));
  },
});

/* Normalise a header string: lowercase, strip spaces */
function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }

const COL = {
  name:        ['name'],
  phone:       ['phonenumber', 'phone'],
  description: ['itemdescription', 'description', 'item'],
  category:    ['category', 'cat'],
  otn:         ['otn', 'trackingnumber'],
};

function resolveHeader(headers) {
  const map = {};
  headers.forEach((raw, idx) => {
    const n = norm(raw);
    for (const [field, aliases] of Object.entries(COL)) {
      if (aliases.includes(n) && !(field in map)) map[field] = idx;
    }
  });
  return map;
}

function parseRows(buffer, mimetype) {
  const isExcel = mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mimetype === 'application/vnd.ms-excel';

  if (isExcel) {
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  }

  return parse(buffer, { relax_column_count: true, skip_empty_lines: false });
}

router.post('/customers', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { shipmentId } = req.query;
    if (!shipmentId) return res.status(400).json({ error: 'shipmentId query parameter is required' });

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId.toUpperCase() } });
    const existingCount = shipment
      ? await prisma.customer.count({ where: { shipmentId: shipment.id } })
      : 0;

    const rows = parseRows(req.file.buffer, req.file.mimetype);
    if (rows.length < 2) return res.status(400).json({ error: 'File is empty or has no data rows' });

    const headers = rows[0].map(String);
    const colMap  = resolveHeader(headers);

    const missing = ['name', 'phone', 'description'].filter(f => !(f in colMap));
    if (missing.length) {
      return res.status(400).json({
        error: `Missing required columns: ${missing.join(', ')}. Expected: Name, Phone Number, Item Description`,
      });
    }

    const errors    = [];
    const byPhone   = new Map();   // phone → { name, items[] }
    const phoneOrder = [];          // insertion order for stable IDs

    for (let i = 1; i < rows.length; i++) {
      const row  = rows[i];
      const rowN = i + 1;

      const name  = String(row[colMap.name]        || '').trim();
      const phone = String(row[colMap.phone]       || '').trim();
      const desc  = String(row[colMap.description] || '').trim();
      const cat   = colMap.category  != null ? String(row[colMap.category]  || '').trim() : '';
      const otn   = colMap.otn       != null ? String(row[colMap.otn]       || '').trim() : '';

      if (!name && !phone && !desc) continue;  // blank row

      if (!name)  { errors.push({ row: rowN, message: 'Name is required' });        continue; }
      if (!phone) { errors.push({ row: rowN, message: 'Phone number is required' }); continue; }
      if (!desc)  { errors.push({ row: rowN, message: 'Item Description is required' }); continue; }

      if (!byPhone.has(phone)) {
        byPhone.set(phone, { name, items: [] });
        phoneOrder.push(phone);
      }

      byPhone.get(phone).items.push({ description: desc, category: cat || 'General', otn: otn || null });
    }

    const shipId  = shipment ? shipment.id : shipmentId.toUpperCase();
    let counter   = existingCount;
    const customers = phoneOrder.map(phone => {
      counter++;
      const { name, items } = byPhone.get(phone);
      return {
        id:    shipId + '-T' + String(counter).padStart(4, '0'),
        name,
        phone,
        items,
      };
    });

    const itemCount = customers.reduce((sum, c) => sum + c.items.length, 0);

    res.json({
      valid:         errors.length === 0,
      customerCount: customers.length,
      itemCount,
      errors,
      customers,
    });
  } catch (err) {
    if (err.message?.includes('Only .csv')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/customers/confirm', requireAuth, async (req, res, next) => {
  try {
    const { shipmentId, customers } = req.body;
    if (!shipmentId) return res.status(400).json({ error: 'shipmentId is required' });
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'customers array is required' });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId.toUpperCase() } });
    if (!shipment) return res.status(404).json({ error: `Shipment ${shipmentId} not found` });

    await Promise.all(
      customers.map(c =>
        prisma.customer.create({
          data: {
            id:         c.id,
            name:       c.name,
            phone:      c.phone,
            shipmentId: shipment.id,
            items: {
              create: (c.items || []).map(it => ({
                description: it.description,
                category:    it.category || 'General',
                otn:         it.otn      || null,
              })),
            },
          },
        })
      )
    );

    res.status(201).json({
      created: customers.length,
      message: `${customers.length} customer${customers.length === 1 ? '' : 's'} added to shipment ${shipment.id}`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
