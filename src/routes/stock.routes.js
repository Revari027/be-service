/**
 * Stock routes (SDD sections 6.2, 6.3 and 7.4).
 *
 * ADMIN and STAFF can record movements; the stock balance is only ever changed
 * through these transactional service calls.
 */
const express = require('express');
const stockController = require('../controllers/stock.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { ROLES, requireRole } = require('../middlewares/role.middleware');
const {
  stockInSchema,
  stockOutSchema,
  stockAdjustmentSchema,
  listMovementQuerySchema,
} = require('../validators/stock.validator');

const router = express.Router();

router.use(authenticate);

router.get('/movements', validate(listMovementQuerySchema, 'query'), stockController.listMovements);

router.post(
  '/in',
  requireRole(ROLES.ADMIN, ROLES.STAFF),
  validate(stockInSchema),
  stockController.stockIn,
);

router.post(
  '/out',
  requireRole(ROLES.ADMIN, ROLES.STAFF),
  validate(stockOutSchema),
  stockController.stockOut,
);

router.post(
  '/adjustment',
  requireRole(ROLES.ADMIN, ROLES.STAFF),
  validate(stockAdjustmentSchema),
  stockController.adjustment,
);

module.exports = router;
