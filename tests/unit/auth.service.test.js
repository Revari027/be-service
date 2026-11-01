jest.mock('../../src/config/database', () => ({
  user: { findUnique: jest.fn() },
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../src/config/database');
const authService = require('../../src/services/auth.service');

const user = {
  id: BigInt(1),
  name: 'Administrator',
  email: 'admin@example.com',
  passwordHash: '$2b$12$storedhash',
  role: 'ADMIN',
};

describe('auth service login', () => {
  it('returns a signed token for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login({ email: 'admin@example.com', password: 'password123' });
    const payload = jwt.verify(result.token, process.env.JWT_SECRET, { issuer: 'inventory-backend' });

    expect(result.user).toBe(user);
    expect(payload.sub).toBe('1');
    expect(payload.role).toBe('ADMIN');
  });

  it('rejects an unknown email with 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'ghost@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });

  it('rejects a wrong password with 401', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'admin@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('returns 404 when the current user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(authService.getCurrentUser(BigInt(99))).rejects.toMatchObject({ statusCode: 404 });
  });
});
