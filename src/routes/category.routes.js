/**
 * Category routes (SDD sections 6.3 and 7.3).
 *
 * Role policy used by this implementation: read is available to ADMIN and STAFF,
 * while creating, updating and deleting categories (master data) is ADMIN only.
 */
const express = require('express');
const categoryController = require('../controllers/category.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { ROLES, requireRole } = require('../middlewares/role.middleware');
const { idParamSchema } = require('../validators/common.validator');
const {
  createCategorySchema,
  updateCategorySchema,
  listCategoryQuerySchema,
} = require('../validators/category.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(listCategoryQuerySchema, 'query'), categoryController.list);
router.get('/:id', validate(idParamSchema, 'params'), categoryController.detail);

router.post(
  '/',
  requireRole(ROLES.ADMIN),
  validate(createCategorySchema),
  categoryController.create,
);

router.put(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(idParamSchema, 'params'),
  validate(updateCategorySchema),
  categoryController.update,
);

router.delete(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(idParamSchema, 'params'),
  categoryController.remove,
);

module.exports = router;
