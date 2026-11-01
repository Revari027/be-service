/**
 * Stock movement endpoints (SDD section 7.4).
 */
const stockService = require('../services/stock.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');
const { toId, toPagination, toStockMovement } = require('../utils/serializer');

function movementPayload(result) {
  return {
    previous_stock: result.previousStock,
    new_stock: result.newStock,
    product: {
      id: toId(result.product.id),
      sku: result.product.sku,
      name: result.product.name,
      stock_quantity: result.product.stockQuantity,
    },
    movement: toStockMovement(result.movement),
  };
}

const listMovements = asyncHandler(async (req, res) => {
  const { page, limit, product_id: productId, type, from, to } = req.query;
  const result = await stockService.listMovements({ page, limit, productId, type, from, to });

  return success(res, {
    message: 'Stock movements retrieved successfully',
    data: {
      items: result.items.map(toStockMovement),
      pagination: toPagination({ page: result.page, limit: result.limit, total: result.total }),
    },
  });
});

const stockIn = asyncHandler(async (req, res) => {
  const { product_id: productId, quantity, reference_number: referenceNumber, notes } = req.body;
  const result = await stockService.stockIn({
    productId,
    userId: req.user.id,
    quantity,
    referenceNumber: referenceNumber ?? null,
    notes: notes ?? null,
  });

  return success(res, {
    status: 201,
    message: 'Stock-in recorded successfully',
    data: movementPayload(result),
  });
});

const stockOut = asyncHandler(async (req, res) => {
  const { product_id: productId, quantity, reference_number: referenceNumber, notes } = req.body;
  const result = await stockService.stockOut({
    productId,
    userId: req.user.id,
    quantity,
    referenceNumber: referenceNumber ?? null,
    notes: notes ?? null,
  });

  return success(res, {
    status: 201,
    message: 'Stock-out recorded successfully',
    data: movementPayload(result),
  });
});

const adjustment = asyncHandler(async (req, res) => {
  const { product_id: productId, quantity, reference_number: referenceNumber, notes } = req.body;
  const result = await stockService.adjustStock({
    productId,
    userId: req.user.id,
    quantity,
    referenceNumber: referenceNumber ?? null,
    notes: notes ?? null,
  });

  return success(res, {
    status: 201,
    message: 'Stock adjustment recorded successfully',
    data: {
      ...movementPayload(result),
      difference: result.delta,
    },
  });
});

module.exports = {
  listMovements,
  stockIn,
  stockOut,
  adjustment,
};
