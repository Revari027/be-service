const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const prisma = require('../../src/config/database');
const { describeIntegration, loginAs } = require('../helpers/db');

describeIntegration('stock movements', () => {
  const suffix = Date.now();
  const email = `it-stock-${suffix}@example.com`;
  const password = 'password123';
  const sku = `STK-IT-${suffix}`;

  let agent;
  let csrfToken;
  let categoryId;
  let productId;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        name: 'IT Stock Admin',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    });

    const category = await prisma.category.create({ data: { name: `STK Category ${suffix}` } });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: { categoryId, sku, name: 'Produk Uji Stok', minimumStock: 5 },
    });
    productId = product.id;

    agent = request.agent(app);
    csrfToken = await loginAs(agent, { email, password });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  async function currentStock() {
    const product = await prisma.product.findUnique({ where: { id: productId } });

    return product.stockQuantity;
  }

  it('records a stock-in and increments the balance', async () => {
    const response = await agent
      .post('/api/v1/stock/in')
      .set('x-csrf-token', csrfToken)
      .send({
        product_id: productId.toString(),
        quantity: 100,
        reference_number: `IN-IT-${suffix}`,
        notes: 'Pembelian supplier',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.previous_stock).toBe(0);
    expect(response.body.data.new_stock).toBe(100);
    expect(await currentStock()).toBe(100);
  });

  it('rejects a duplicate reference number and rolls the balance back', async () => {
    const response = await agent
      .post('/api/v1/stock/in')
      .set('x-csrf-token', csrfToken)
      .send({
        product_id: productId.toString(),
        quantity: 10,
        reference_number: `IN-IT-${suffix}`,
      });

    expect(response.status).toBe(409);
    expect(await currentStock()).toBe(100);
  });

  it('rejects a stock-out larger than the balance', async () => {
    const response = await agent
      .post('/api/v1/stock/out')
      .set('x-csrf-token', csrfToken)
      .send({ product_id: productId.toString(), quantity: 101 });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Insufficient stock');
    expect(await currentStock()).toBe(100);
  });

  it('records an adjustment using the counted stock', async () => {
    const response = await agent
      .post('/api/v1/stock/adjustment')
      .set('x-csrf-token', csrfToken)
      .send({ product_id: productId.toString(), quantity: 90, notes: 'Stok opname' });

    expect(response.status).toBe(201);
    expect(response.body.data.new_stock).toBe(90);
    expect(await currentStock()).toBe(90);
  });

  it('serializes concurrent stock-out requests without overselling', async () => {
    const payload = { product_id: productId.toString(), quantity: 60 };

    const [first, second] = await Promise.all([
      agent.post('/api/v1/stock/out').set('x-csrf-token', csrfToken).send(payload),
      agent.post('/api/v1/stock/out').set('x-csrf-token', csrfToken).send(payload),
    ]);

    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([201, 409]);
    expect(await currentStock()).toBe(30);
  });

  it('lists movement history for the product', async () => {
    const response = await agent.get(`/api/v1/stock/movements?product_id=${productId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.items[0].product_id).toBe(productId.toString());
  });
});
