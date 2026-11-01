/**
 * Authentication request schemas (SDD section 7.1).
 */
const { z } = require('zod');

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('must be a valid email address').max(150),
    password: z.string().min(8, 'must be at least 8 characters').max(128),
  })
  .strict();

module.exports = {
  loginSchema,
};
