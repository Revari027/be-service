const { requireRole, ROLES } = require('../../src/middlewares/role.middleware');

function run(middleware, user) {
  const next = jest.fn();

  middleware({ user }, {}, next);

  return next;
}

describe('role authorization', () => {
  it('allows a matching role', () => {
    const next = run(requireRole(ROLES.ADMIN), { role: 'ADMIN' });

    expect(next).toHaveBeenCalledWith();
  });

  it('allows STAFF on endpoints open to both roles', () => {
    const next = run(requireRole(ROLES.ADMIN, ROLES.STAFF), { role: 'STAFF' });

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects STAFF on an ADMIN only endpoint with 403', () => {
    const next = run(requireRole(ROLES.ADMIN), { role: 'STAFF' });
    const error = next.mock.calls[0][0];

    expect(error.statusCode).toBe(403);
  });

  it('rejects an unauthenticated request with 401', () => {
    const next = run(requireRole(ROLES.ADMIN), undefined);
    const error = next.mock.calls[0][0];

    expect(error.statusCode).toBe(401);
  });
});
