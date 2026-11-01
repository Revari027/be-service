/**
 * Category request schemas (SDD section 7.3).
 */
const { z } = require('zod');
const { searchSchema } = require('./common.validator');

const nameField = z.string().trim().min(1, 'is required').max(100, 'must be at most 100 characters');
const descriptionField = z.string().max(65535, 'is too long').nullish();

const createCategorySchema = z
  .object({
    name: nameField,
    description: descriptionField,
  })
  .strict();

const updateCategorySchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField,
  })
  .strict()
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    { message: 'At least one field must be provided' },
  );

const listCategoryQuerySchema = z.object({
  search: searchSchema.optional(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  listCategoryQuerySchema,
};
