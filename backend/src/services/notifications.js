import { prisma } from '../index.js';
import { sendSMS, sendWhatsApp } from './hubtel.js';

function renderTemplate(template, vars) {
  return template
    .replace(/{customer_name}/g, vars.customerName)
    .replace(/{tracking_number}/g, vars.trackingNumber)
    .replace(/{shipment_id}/g, vars.shipmentId)
    .replace(/{shipment_type}/g, vars.shipmentType);
}

export async function sendStatusNotifications(shipment, stageIndex) {
  const template = await prisma.notificationTemplate.findUnique({
    where: { type_stage: { type: shipment.type, stage: stageIndex } },
  });

  if (!template) {
    console.warn(`⚠️  No template found for ${shipment.type} stage ${stageIndex}`);
    return;
  }

  const shipmentType = shipment.type === 'SEA' ? 'Sea Freight' : 'Air Freight';
  const customers = shipment.customers || [];

  const tasks = customers.map(async (customer) => {
    if (customer.delivered) return;

    const message = renderTemplate(template.message, {
      customerName: customer.name,
      trackingNumber: customer.id,
      shipmentId: shipment.id,
      shipmentType,
    });

    const [smsResult, waResult] = await Promise.all([
      sendSMS({ to: customer.phone, message }),
      sendWhatsApp({ to: customer.phone, message }),
    ]);

    await prisma.notificationLog.createMany({
      data: [
        { customerId: customer.id, stage: stageIndex, channel: 'SMS', status: smsResult.success ? 'SENT' : 'FAILED', error: smsResult.success ? null : smsResult.reason },
        { customerId: customer.id, stage: stageIndex, channel: 'WHATSAPP', status: waResult.success ? 'SENT' : 'FAILED', error: waResult.success ? null : waResult.reason },
      ],
    });

    console.log(`  📱 ${customer.name} — SMS: ${smsResult.success ? '✓' : '✗'} | WA: ${waResult.success ? '✓' : '✗'}`);
  });

  await Promise.allSettled(tasks);
  console.log(`✅  Notifications sent for ${shipment.id} → stage ${stageIndex}`);
}