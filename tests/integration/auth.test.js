const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const prisma = require('../../src/config/database');
const { describeIntegration } = require('../helpers/db');

describeIntegration('authentication and authorization', () => {
  const suffix = Date.now();
  const adminEmail = `it-admin-${suffix}@example.com`;
  const staffEmail = `it-staff-${suffix}@example.com`;
  const password = 'password123';

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { name: 'IT Admin', email: adminEmail, passwordHash, role: 'ADMIN' },
    });
    await prisma.user.create({
      data: { name: 'IT Staff', email: staffEmail, passwordHash, role: 'STAFF' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, staffEmail] } } });
    await prisma.$disconnect();
  });

  it('logs in with valid credentials and does not leak the password hash', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(adminEmail);
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(String(response.headers['set-cookie'])).toContain('inventory_token=');
  });

  it('rejects an invalid password with 401', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('rejects a protected endpoint without a session', async () => {
    const response = await request(app).get('/api/v1/products');

    expect(response.status).toBe(401);
  });

  it('returns the current user for a valid session', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/login').send({ email: adminEmail, password });
    const response = await agent.get('/api/v1/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(adminEmail);
  });

  it('forbids a STAFF user from deleting a product', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: staffEmail, password });

    const response = await agent
      .delete('/api/v1/products/1')
      .set('x-csrf-token', login.body.data.csrf_token);

    expect(response.status).toBe(403);
  });

  it('rejects a state-changing request without the CSRF header', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/login').send({ email: adminEmail, password });
    const response = await agent.post('/api/v1/stock/in').send({ product_id: 1, quantity: 1 });

    expect(response.status).toBe(403);
  });
});
