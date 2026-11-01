/**
 * Shared Zod building blocks (SDD section 9.1).
 */
const { z } = require('zod');

// Accepts 1, "1" and converts to a positive BigInt for Prisma queries.
const idSchema = z
  .preprocess(
    (value) => (typeof value === 'number' && Number.isInteger(value) ? String(value) : value),
    z
      .string({
        required_error: 'is required',
        invalid_type_error: 'must be a positive integer',
      })
      .regex(/^[1-9]\d*$/, 'must be a positive integer'),
  )
  .transform((value) => BigInt(value));

const idParamSchema = z.object({
  id: idSchema,
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const moneySchema = z.coerce
  .number({ invalid_type_error: 'must be a number' })
  .finite('must be a finite number')
  .min(0, 'must not be negative')
  .max(9999999999999.99, 'must be at most 9999999999999.99')
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    'must have at most 2 decimal places',
  );

const searchSchema = z.string().trim().min(1).max(100);

module.exports = {
  idSchema,
  idParamSchema,
  paginationSchema,
  moneySchema,
  searchSchema,
};
