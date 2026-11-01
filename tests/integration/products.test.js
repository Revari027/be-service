const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const prisma = require('../../src/config/database');
const { describeIntegration, loginAs } = require('../helpers/db');

describeIntegration('products and categories', () => {
  const suffix = Date.now();
  const email = `it-product-${suffix}@example.com`;
  const password = 'password123';
  const sku = `PRD-IT-${suffix}`;

  let agent;
  let csrfToken;
  let categoryId;
  const extraCategoryName = `IT Category Extra ${suffix}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        name: 'IT Admin',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    });

    const category = await prisma.category.create({
      data: { name: `IT Category ${suffix}` },
    });
    categoryId = category.id;

    agent = request.agent(app);
    csrfToken = await loginAs(agent, { email, password });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { product: { sku } } });
    await prisma.product.deleteMany({ where: { sku } });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({
      where: { name: { in: [`IT Category ${suffix}`, extraCategoryName] } },
    });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  const productPayload = () => ({
    category_id: categoryId.toString(),
    sku,
    name: 'Laptop ASUS',
    description: 'Laptop untuk kebutuhan kantor',
    purchase_price: 7500000,
    selling_price: 8500000,
    minimum_stock: 5,
  });

  it('creates a category', async () => {
    const response = await agent
      .post('/api/v1/categories')
      .set('x-csrf-token', csrfToken)
      .send({ name: extraCategoryName, description: 'temporary' });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe(extraCategoryName);
  });

  it('creates a product with zero stock', async () => {
    const response = await agent
      .post('/api/v1/products')
      .set('x-csrf-token', csrfToken)
      .send(productPayload());

    expect(response.status).toBe(201);
    expect(response.body.data.sku).toBe(sku);
    expect(response.body.data.stock_quantity).toBe(0);
    expect(response.body.data.id).toEqual(expect.any(String));
  });

  it('rejects a duplicate SKU with 409', async () => {
    const response = await agent
      .post('/api/v1/products')
      .set('x-csrf-token', csrfToken)
      .send({ ...productPayload(), name: 'Laptop lain' });

    expect(response.status).toBe(409);
  });

  it('rejects stock_quantity in a create request', async () => {
    const response = await agent
      .post('/api/v1/products')
      .set('x-csrf-token', csrfToken)
      .send({ ...productPayload(), sku: `${sku}-X`, stock_quantity: 10 });

    expect(response.status).toBe(400);
  });

  it('rejects an unknown category with 404', async () => {
    const response = await agent
      .post('/api/v1/products')
      .set('x-csrf-token', csrfToken)
      .send({ ...productPayload(), sku: `${sku}-Y`, category_id: '999999999' });

    expect(response.status).toBe(404);
  });

  it('lists products with pagination metadata', async () => {
    const response = await agent.get('/api/v1/products?page=1&limit=10&search=Laptop');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.pagination.page).toBe(1);
  });

  it('updates a product without touching the stock', async () => {
    const created = await prisma.product.findUnique({ where: { sku } });

    const response = await agent
      .put(`/api/v1/products/${created.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Laptop ASUS Updated' });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Laptop ASUS Updated');
    expect(response.body.data.stock_quantity).toBe(created.stockQuantity);
  });
});
