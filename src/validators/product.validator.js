/**
 * Product request schemas (SDD section 7.2).
 *
 * stock_quantity is deliberately absent from the schemas and both create and
 * update use .strict(), so a client that tries to change stock through the
 * product endpoints receives a validation error instead of silently writing the
 * balance. Stock only changes through /stock/* (SDD sections 6.1 and 7.2).
 */
const { z } = require('zod');
const { idSchema, paginationSchema, moneySchema, searchSchema } = require('./common.validator');

const skuField = z.string().trim().min(1, 'is required').max(50, 'must be at most 50 characters');
const nameField = z.string().trim().min(1, 'is required').max(150, 'must be at most 150 characters');
const descriptionField = z.string().max(65535, 'is too long').nullish();
const minimumStockField = z.coerce
  .number()
  .int('must be an integer')
  .min(0, 'must not be negative')
  .max(4294967295, 'is too large');

const createProductSchema = z
  .object({
    category_id: idSchema,
    sku: skuField,
    name: nameField,
    description: descriptionField,
    purchase_price: moneySchema.default(0),
    selling_price: moneySchema.default(0),
    minimum_stock: minimumStockField.default(5),
  })
  .strict();

const updateProductSchema = z
  .object({
    category_id: idSchema.optional(),
    sku: skuField.optional(),
    name: nameField.optional(),
    description: descriptionField,
    purchase_price: moneySchema.optional(),
    selling_price: moneySchema.optional(),
    minimum_stock: minimumStockField.optional(),
  })
  .strict()
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    { message: 'At least one field must be provided' },
  );

const listProductQuerySchema = paginationSchema
  .extend({
    search: searchSchema.optional(),
    category_id: idSchema.optional(),
    sort: z
      .enum([
        'name',
        '-name',
        'sku',
        '-sku',
        'created_at',
        '-created_at',
        'updated_at',
        '-updated_at',
        'stock_quantity',
        '-stock_quantity',
        'selling_price',
        '-selling_price',
        'purchase_price',
        '-purchase_price',
      ])
      .default('-created_at'),
  })
  .strict();

module.exports = {
  createProductSchema,
  updateProductSchema,
  listProductQuerySchema,
};
