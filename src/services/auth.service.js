/**
 * Authentication business logic (SDD section 7.1).
 *
 * Session state is a signed JWT delivered as an HttpOnly cookie by the
 * controller; the signing secret never leaves the backend.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const env = require('../config/env');
const { notFound, unauthorized } = require('../utils/errors');

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn,
      issuer: env.jwt.issuer,
    },
  );
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // The same message is returned for unknown users and wrong passwords so the
  // endpoint cannot be used to enumerate registered emails.
  if (!user) {
    throw unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  return { token: signToken(user), user };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw notFound('User not found');
  }

  return user;
}

module.exports = {
  login,
  getCurrentUser,
  signToken,
};
