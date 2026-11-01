/**
 * Standard response envelope (SDD section 7.7).
 */
function success(res, { status = 200, message = 'OK', data = null } = {}) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

function failure(res, { status = 500, message = 'Internal server error', errors = null } = {}) {
  return res.status(status).json({
    success: false,
    message,
    errors: errors ?? null,
  });
}

module.exports = { success, failure };
