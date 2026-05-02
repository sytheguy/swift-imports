import { PrismaClient, ShipmentType, ShipmentStatus, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding Swift Imports database...\n');

  await prisma.notificationLog.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.item.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.user.deleteMany();

  console.log('  Creating users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.createMany({
    data: [
      { id: 'user-ama-kusi', name: 'Ama Kusi', email: 'ama@swiftimports.com', role: UserRole.ADMIN, status: UserStatus.ACTIVE, passwordHash },
      { id: 'user-kweku', name: 'Kweku Acheampong', email: 'kweku@swiftimports.com', role: UserRole.ADMIN, status: UserStatus.ACTIVE, passwordHash },
      { id: 'user-efua', name: 'Efua Agyei', phone: '0244001122', role: UserRole.STAFF, status: UserStatus.ACTIVE, passwordHash },
      { id: 'user-yaw', name: 'Yaw Dankwa', phone: '0277334455', role: UserRole.STAFF, status: UserStatus.INACTIVE, passwordHash },
      { id: 'user-abena-boateng', name: 'Abena Boateng', email: 'abena@swiftimports.com', role: UserRole.STAFF, status: UserStatus.PENDING, inviteToken: 'demo-invite-token-abena' },
    ],
  });
  console.log('  ✓ 5 users created');

  console.log('  Creating shipment SW0404S...');
  await prisma.shipment.create({
    data: {
      id: 'SW0404S',
      type: ShipmentType.SEA,
      status: ShipmentStatus.EN_ROUTE,
      date: new Date('2026-04-04'),
      notes: 'Handle with care — fragile items in batch.',
      enRouteDate: new Date('2026-04-04'),
      customers: {
        create: [
          {
            id: 'SW0404S-T0001', name: 'Kofi Mensah', phone: '0241234567',
            items: { create: [
              { description: 'Nike Air Max Size 10', category: 'Footwear', otn: 'CN-887231-A' },
              { description: 'iPhone 15 Case Black', category: 'Accessories', otn: 'CN-887231-B' },
              { description: 'Portable Bluetooth Speaker', category: 'Electronics', otn: 'CN-887231-C' },
            ]},
          },
          {
            id: 'SW0404S-T0002', name: 'Ama Owusu', phone: '0557654321',
            items: { create: [
              { description: 'Brazilian Wigs x3', category: 'Beauty', otn: 'CN-887232-A' },
            ]},
          },
          {
            id: 'SW0404S-T0003', name: 'Kwame Asante', phone: '0277001122',
            items: { create: [
              { description: 'Smartwatch Band', category: 'Accessories', otn: 'CN-887233-A' },
              { description: 'Laptop Stand Aluminium', category: 'Electronics', otn: 'CN-887233-B' },
              { description: 'Wireless Keyboard', category: 'Electronics', otn: 'CN-887233-C' },
              { description: 'USB-C Hub 7-in-1', category: 'Electronics', otn: 'CN-887233-D' },
              { description: 'Phone Ring Light', category: 'Accessories', otn: null },
            ]},
          },
          {
            id: 'SW0404S-T0004', name: 'Abena Frimpong', phone: '0209876543',
            items: { create: [
              { description: 'Portable Speaker', category: 'Electronics', otn: 'CN-887234-A' },
              { description: 'Silk Bonnet', category: 'Beauty', otn: null },
            ]},
          },
          {
            id: 'SW0404S-T0005', name: 'Yaw Darko', phone: '0244556677',
            items: { create: [
              { description: 'Gaming Mouse', category: 'Electronics', otn: 'CN-887235-A' },
              { description: 'Mechanical Keyboard', category: 'Electronics', otn: 'CN-887235-B' },
              { description: 'Monitor Stand', category: 'Electronics', otn: null },
              { description: 'Webcam HD', category: 'Electronics', otn: 'CN-887235-D' },
            ]},
          },
          {
            id: 'SW0404S-T0006', name: 'Efua Boateng', phone: '0201234567',
            items: { create: [
              { description: 'Yoga Mat', category: 'Fitness', otn: 'CN-887236-A' },
              { description: 'Resistance Bands Set', category: 'Fitness', otn: null },
            ]},
          },
        ],
      },
    },
  });
  console.log('  ✓ Shipment SW0404S with 6 customers and 17 items');

  console.log('  Creating additional demo shipments...');
  await prisma.shipment.createMany({
    data: [
      { id: 'SW0403A', type: ShipmentType.AIR, status: ShipmentStatus.ARRIVED_GHANA, date: new Date('2026-04-03') },
      { id: 'SW0402S', type: ShipmentType.SEA, status: ShipmentStatus.AT_WAREHOUSE_GHANA, date: new Date('2026-04-02') },
      { id: 'SW0401A', type: ShipmentType.AIR, status: ShipmentStatus.CLEARED_CUSTOMS, date: new Date('2026-04-01') },
      { id: 'SW0305S', type: ShipmentType.SEA, status: ShipmentStatus.DELIVERED, date: new Date('2026-03-05') },
      { id: 'SW0304A', type: ShipmentType.AIR, status: ShipmentStatus.DELIVERED, date: new Date('2026-03-04') },
      { id: 'SW0303S', type: ShipmentType.SEA, status: ShipmentStatus.IN_WAREHOUSE_CHINA, date: new Date('2026-03-03') },
    ],
  });
  console.log('  ✓ 6 additional demo shipments');

  console.log('  Creating notification templates...');
  const templates = [
    { type: ShipmentType.SEA, stage: 0, message: 'Hi {customer_name}, your shipment {shipment_id} is at our China warehouse and being prepared for shipping. Tracking: {tracking_number}.' },
    { type: ShipmentType.SEA, stage: 1, message: "Hi {customer_name}, your shipment {shipment_id} is en route via sea freight. We'll notify you when it arrives. Tracking: {tracking_number}." },
    { type: ShipmentType.SEA, stage: 2, message: 'Hi {customer_name}, your shipment {shipment_id} has arrived in Ghana and is going through customs. Tracking: {tracking_number}.' },
    { type: ShipmentType.SEA, stage: 3, message: 'Hi {customer_name}, your shipment {shipment_id} has cleared customs. Tracking: {tracking_number}.' },
    { type: ShipmentType.SEA, stage: 4, message: 'Hi {customer_name}, your items from {shipment_id} are at our Ghana warehouse, ready for dispatch. Tracking: {tracking_number}.' },
    { type: ShipmentType.SEA, stage: 5, message: 'Hi {customer_name}, your items from {shipment_id} are out for delivery today! Tracking: {tracking_number}.' },
    { type: ShipmentType.SEA, stage: 6, message: 'Hi {customer_name}, your items from {shipment_id} have been delivered. Thank you for choosing Swift Imports! Tracking: {tracking_number}.' },
    { type: ShipmentType.AIR, stage: 0, message: 'Hi {customer_name}, your shipment {shipment_id} is at our China warehouse, being prepared for air freight. Tracking: {tracking_number}.' },
    { type: ShipmentType.AIR, stage: 1, message: 'Hi {customer_name}, your shipment {shipment_id} is en route via air freight. Tracking: {tracking_number}.' },
    { type: ShipmentType.AIR, stage: 2, message: 'Hi {customer_name}, your shipment {shipment_id} has landed in Ghana. Customs clearance is underway. Tracking: {tracking_number}.' },
    { type: ShipmentType.AIR, stage: 3, message: 'Hi {customer_name}, your shipment {shipment_id} has cleared customs. Tracking: {tracking_number}.' },
    { type: ShipmentType.AIR, stage: 4, message: 'Hi {customer_name}, your items from {shipment_id} are at our Ghana warehouse. Tracking: {tracking_number}.' },
    { type: ShipmentType.AIR, stage: 5, message: 'Hi {customer_name}, your items from {shipment_id} are out for delivery today! Tracking: {tracking_number}.' },
    { type: ShipmentType.AIR, stage: 6, message: 'Hi {customer_name}, your items from {shipment_id} have been delivered. Thank you! Tracking: {tracking_number}.' },
  ];

  for (const tpl of templates) {
    await prisma.notificationTemplate.upsert({
      where: { type_stage: { type: tpl.type, stage: tpl.stage } },
      update: { message: tpl.message },
      create: tpl,
    });
  }
  console.log('  ✓ 14 notification templates (7 sea + 7 air)');

  console.log('\n✅  Seed complete.');
  console.log('\n   Demo login credentials:');
  console.log('   Email:    ama@swiftimports.com');
  console.log('   Password: password123\n');
}

main()
  .catch(e => { console.error('❌  Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());