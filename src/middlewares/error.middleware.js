/**
 * 404 handler and centralized error handler (SDD section 7.7).
 *
 * Internal details (stack traces, driver messages, secrets) never reach the
 * client; only the mapped status code and a safe message are returned.
 */
const { Prisma } = require('@prisma/client');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { failure } = require('../utils/response');

function notFoundHandler(req, res, next) {
  return next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
}

function fromPrismaError(error) {
  switch (error.code) {
    case 'P2002': {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(', ')
        : error.meta?.target;

      return new AppError(
        target ? `Duplicate value for ${target}` : 'Duplicate value',
        409,
        target ? [{ field: String(target), message: 'must be unique' }] : null,
      );
    }
    case 'P2003':
      return new AppError('Operation conflicts with a related record', 409);
    case 'P2025':
      return new AppError('Record not found', 404);
    case 'P2034':
      return new AppError('Transaction conflict detected, please retry', 409);
    default:
      return new AppError('Database error', 500);
  }
}

function toHttpError(error) {
  if (error instanceof AppError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) return fromPrismaError(error);

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError('Invalid query parameters', 400);
  }

  if (error && error.type === 'entity.parse.failed') {
    return new AppError('Malformed JSON body', 400);
  }

  if (error && error.type === 'entity.too.large') {
    return new AppError('Request payload too large', 413);
  }

  if (error && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) {
    return new AppError('Invalid or expired session', 401);
  }

  return new AppError('Internal server error', 500);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const httpError = toHttpError(error);

  if (httpError.statusCode >= 500) {
    console.error('[error]', {
      method: req.method,
      path: req.originalUrl,
      message: error && error.message,
      stack: env.isProduction ? undefined : error && error.stack,
    });
  }

  return failure(res, {
    status: httpError.statusCode,
    message: httpError.message,
    errors: httpError.errors ?? null,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
