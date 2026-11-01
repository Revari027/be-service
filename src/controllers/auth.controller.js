/**
 * Authentication endpoints (SDD section 7.1).
 *
 * The session token is set as an HttpOnly cookie; a CSRF cookie/header pair
 * accompanies it for state-changing requests. The token itself is not returned
 * in the response body.
 */
const authService = require('../services/auth.service');
const { createCsrfToken } = require('../middlewares/auth.middleware');
const env = require('../config/env');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');
const { toUser } = require('../utils/serializer');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { token, user } = await authService.login({ email, password });
  const csrfToken = createCsrfToken();

  res.cookie(env.cookie.name, token, env.cookie.options);
  res.cookie(env.cookie.csrfCookieName, csrfToken, env.cookie.csrfOptions);

  return success(res, {
    message: 'Login successful',
    data: {
      user: toUser(user),
      csrf_token: csrfToken,
    },
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);

  return success(res, {
    message: 'Current user retrieved successfully',
    data: {
      user: toUser(user),
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(env.cookie.name, env.cookie.clearOptions);
  res.clearCookie(env.cookie.csrfCookieName, env.cookie.csrfClearOptions);

  return success(res, {
    message: 'Logout successful',
    data: null,
  });
});

module.exports = {
  login,
  me,
  logout,
};
