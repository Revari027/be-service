/**
 * Request validation middleware backed by Zod schemas (SDD section 9.1).
 *
 * Usage: router.post('/', validate(createProductSchema), handler)
 *        router.get('/', validate(listQuerySchema, 'query'), handler)
 */
const { badRequest } = require('../utils/errors');

function formatIssues(error, source) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : source,
    message: issue.message,
  }));
}

function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = formatIssues(result.error, source);

      return next(badRequest('Validation error', errors));
    }

    if (source === 'query') {
      // Express 4 exposes req.query through a prototype getter, so the parsed
      // value is defined as an own property to replace it safely.
      Object.defineProperty(req, 'query', {
        value: result.data,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    } else {
      req[source] = result.data;
    }

    return next();
  };
}

module.exports = validate;
