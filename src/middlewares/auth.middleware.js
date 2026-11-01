/**
 * Authentication and CSRF middleware (SDD sections 7.1 and 9.1).
 *
 * The session token lives in an HttpOnly cookie. A second, readable cookie
 * (csrf_token) carries a random value that state-changing requests must echo in
 * the X-CSRF-Token header (double-submit cookie pattern). Requests authenticated
 * with an Authorization: Bearer header are not cookie based and therefore not
 * exposed to CSRF, so the check is skipped for them.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { forbidden, unauthorized } = require('../utils/errors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function extractToken(req) {
  const cookieToken = req.cookies ? req.cookies[env.cookie.name] : null;

  if (cookieToken) {
    return { token: cookieToken, fromCookie: true };
  }

  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');

  if (scheme && value && scheme.toLowerCase() === 'bearer') {
    return { token: value.trim(), fromCookie: false };
  }

  return { token: null, fromCookie: false };
}

function safeCompare(received, expected) {
  const receivedBuffer = Buffer.from(String(received));
  const expectedBuffer = Buffer.from(String(expected));

  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function authenticate(req, res, next) {
  const { token } = extractToken(req);

  if (!token) {
    return next(unauthorized('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret, { issuer: env.jwt.issuer });

    req.user = {
      id: BigInt(payload.sub),
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };

    return next();
  } catch (error) {
    return next(unauthorized('Invalid or expired session'));
  }
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const { fromCookie, token } = extractToken(req);

  // Bearer token clients do not rely on ambient credentials.
  if (!fromCookie || !token) return next();

  const cookieToken = req.cookies ? req.cookies[env.cookie.csrfCookieName] : null;
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || !safeCompare(headerToken, cookieToken)) {
    return next(forbidden('Invalid or missing CSRF token'));
  }

  return next();
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  authenticate,
  csrfProtection,
  createCsrfToken,
};
