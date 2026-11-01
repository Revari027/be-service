/**
 * Product routes (SDD sections 6.3 and 7.2).
 *
 * Role policy used by this implementation:
 * - read: ADMIN and STAFF
 * - create/update: ADMIN and STAFF (day to day catalog maintenance)
 * - delete: ADMIN only
 */
const express = require('express');
const productController = require('../controllers/product.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { ROLES, requireRole } = require('../middlewares/role.middleware');
const { idParamSchema } = require('../validators/common.validator');
const {
  createProductSchema,
  updateProductSchema,
  listProductQuerySchema,
} = require('../validators/product.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(listProductQuerySchema, 'query'), productController.list);
router.get('/:id', validate(idParamSchema, 'params'), productController.detail);

router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.STAFF),
  validate(createProductSchema),
  productController.create,
);

router.put(
  '/:id',
  requireRole(ROLES.ADMIN, ROLES.STAFF),
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  productController.update,
);

router.delete(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(idParamSchema, 'params'),
  productController.remove,
);

module.exports = router;
