/**
 * Role based authorization (SDD section 6.3).
 *
 * Always mounted after authenticate so req.user is present.
 */
const { forbidden, unauthorized } = require('../utils/errors');

const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
};

function requireRole(...roles) {
  return function requireRoleMiddleware(req, res, next) {
    if (!req.user) {
      return next(unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(forbidden('You do not have permission to perform this action'));
    }

    return next();
  };
}

module.exports = {
  ROLES,
  requireRole,
};
