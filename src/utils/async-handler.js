/**
 * Wraps async route handlers so rejected promises reach the error middleware.
 */
function asyncHandler(handler) {
  return function asyncHandlerWrapper(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
