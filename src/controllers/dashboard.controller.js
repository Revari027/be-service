/**
 * Dashboard endpoints (SDD section 7.5).
 *
 * Read-only aggregate queries. The low-stock comparison needs a column to column
 * comparison, which Prisma's query API does not express, so it uses a parameter
 * free raw query with a validated, integer LIMIT.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');
const { toDecimalString, toId, toStockMovement } = require('../utils/serializer');

function parseLimit(value, fallback = 10) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) return fallback;

  return Math.min(parsed, 100);
}

function toNumber(value) {
  if (value === null || value === undefined) return 0;

  return Number(value.toString());
}

const summary = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    productCount,
    categoryCount,
    userCount,
    stockAggregate,
    lowStockRows,
    todayMovementCount,
    valueRows,
  ] = await prisma.$transaction([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.product.aggregate({ _sum: { stockQuantity: true } }),
    prisma.$queryRaw(
      Prisma.sql`SELECT COUNT(*) AS total FROM products WHERE stock_quantity <= minimum_stock`,
    ),
    prisma.stockMovement.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.$queryRaw(
      Prisma.sql`SELECT
          COALESCE(SUM(stock_quantity * purchase_price), 0) AS purchase_value,
          COALESCE(SUM(stock_quantity * selling_price), 0) AS selling_value
        FROM products`,
    ),
  ]);

  const values = valueRows[0] || {};

  return success(res, {
    message: 'Dashboard summary retrieved successfully',
    data: {
      total_products: productCount,
      total_categories: categoryCount,
      total_users: userCount,
      total_stock_quantity: stockAggregate._sum.stockQuantity ?? 0,
      low_stock_count: toNumber(lowStockRows[0] ? lowStockRows[0].total : 0),
      movements_today: todayMovementCount,
      total_purchase_value: toDecimalString(values.purchase_value ?? 0),
      total_selling_value: toDecimalString(values.selling_value ?? 0),
    },
  });
});

const lowStock = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);

  const rows = await prisma.$queryRaw(
    Prisma.sql`SELECT
        p.id,
        p.sku,
        p.name,
        p.stock_quantity,
        p.minimum_stock,
        p.category_id,
        c.name AS category_name
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      WHERE p.stock_quantity <= p.minimum_stock
      ORDER BY p.stock_quantity ASC, p.name ASC
      LIMIT ${Prisma.raw(String(limit))}`,
  );

  return success(res, {
    message: 'Low stock products retrieved successfully',
    data: {
      items: rows.map((row) => ({
        id: toId(row.id),
        sku: row.sku,
        name: row.name,
        stock_quantity: Number(row.stock_quantity),
        minimum_stock: Number(row.minimum_stock),
        category_id: toId(row.category_id),
        category_name: row.category_name,
        shortage: Math.max(0, Number(row.minimum_stock) - Number(row.stock_quantity)),
      })),
      total: rows.length,
    },
  });
});

const recentMovements = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);

  const movements = await prisma.stockMovement.findMany({
    include: {
      product: { select: { id: true, sku: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return success(res, {
    message: 'Recent stock movements retrieved successfully',
    data: {
      items: movements.map(toStockMovement),
      total: movements.length,
    },
  });
});

module.exports = {
  summary,
  lowStock,
  recentMovements,
};
