/**
 * Stock movement request schemas (SDD section 7.4).
 *
 * quantity is always a positive integer for stock-in/stock-out. For an
 * adjustment, quantity is the *counted physical stock* (hasil stok opname), so 0
 * is a valid value; the service stores the absolute difference as the movement
 * quantity and records the direction in the notes.
 */
const { z } = require('zod');
const { idSchema, paginationSchema } = require('./common.validator');

const referenceNumberField = z
  .union([z.string().trim().min(1, 'must not be empty').max(100, 'must be at most 100 characters'), z.null()])
  .optional();

const notesField = z.string().max(65535, 'is too long').nullish();

const positiveQuantityField = z.coerce
  .number()
  .int('must be an integer')
  .min(1, 'must be greater than zero')
  .max(4294967295, 'is too large');

const countedQuantityField = z.coerce
  .number()
  .int('must be an integer')
  .min(0, 'must not be negative')
  .max(4294967295, 'is too large');

const stockInSchema = z
  .object({
    product_id: idSchema,
    quantity: positiveQuantityField,
    reference_number: referenceNumberField,
    notes: notesField,
  })
  .strict();

const stockOutSchema = z
  .object({
    product_id: idSchema,
    quantity: positiveQuantityField,
    reference_number: referenceNumberField,
    notes: notesField,
  })
  .strict();

const stockAdjustmentSchema = z
  .object({
    product_id: idSchema,
    quantity: countedQuantityField,
    reference_number: referenceNumberField,
    notes: notesField,
  })
  .strict();

const listMovementQuerySchema = paginationSchema
  .extend({
    product_id: idSchema.optional(),
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']).optional(),
    from: z.coerce.date({ invalid_type_error: 'must be a valid date' }).optional(),
    to: z.coerce.date({ invalid_type_error: 'must be a valid date' }).optional(),
  })
  .strict();

module.exports = {
  stockInSchema,
  stockOutSchema,
  stockAdjustmentSchema,
  listMovementQuerySchema,
};
