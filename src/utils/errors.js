/**
 * Typed application errors. The error middleware maps statusCode/errors straight
 * into the standard error response envelope (SDD section 7.7).
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const badRequest = (message = 'Validation error', errors = null) => new AppError(message, 400, errors);
const unauthorized = (message = 'Unauthenticated') => new AppError(message, 401);
const forbidden = (message = 'Forbidden') => new AppError(message, 403);
const notFound = (message = 'Not found') => new AppError(message, 404);
const conflict = (message = 'Conflict', errors = null) => new AppError(message, 409, errors);

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
};
