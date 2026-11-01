/**
 * Stock movement business logic (SDD sections 6.2, 7.4 and 9.3).
 *
 * Every stock change:
 * 1. runs inside a single database transaction,
 * 2. locks the product row with SELECT ... FOR UPDATE before reading the balance,
 * 3. writes the product balance and the movement record together, so a failure
 *    rolls back both,
 * 4. rejects reused reference numbers (idempotency guard) and never lets the
 *    balance go negative.
 *
 * Adjustment definition (agreed for this implementation): `quantity` is the
 * counted physical stock. The stored movement quantity is the absolute
 * difference against the balance at that moment and the direction is written to
 * notes, because stock_movements.quantity is INT UNSIGNED and cannot be signed.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../config/database');
const { badRequest, conflict, notFound } = require('../utils/errors');

const UNSIGNED_INT_MAX = 4294967295;

const TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 15000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

const movementInclude = {
  product: { select: { id: true, sku: true, name: true } },
  user: { select: { id: true, name: true } },
};

function assertPositiveInteger(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw badRequest('Quantity must be a positive integer', [
      { field: 'quantity', message: 'must be a positive integer' },
    ]);
  }
}

function assertCountedQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw badRequest('Counted quantity must be a non-negative integer', [
      { field: 'quantity', message: 'must be a non-negative integer' },
    ]);
  }
}

function assertStockFits(balance) {
  if (balance > UNSIGNED_INT_MAX) {
    throw badRequest('Resulting stock exceeds the supported maximum', [
      { field: 'quantity', message: 'resulting stock is too large' },
    ]);
  }
}

async function assertReferenceAvailable(referenceNumber, client) {
  if (!referenceNumber) return;

  const existing = await client.stockMovement.findUnique({
    where: { referenceNumber },
    select: { id: true },
  });

  if (existing) {
    throw conflict('Reference number has already been used', [
      { field: 'reference_number', message: 'must be unique' },
    ]);
  }
}

async function lockProductRow(tx, productId) {
  const rows = await tx.$queryRaw`
    SELECT id, sku, stock_quantity
    FROM products
    WHERE id = ${productId}
    FOR UPDATE
  `;

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw notFound('Product not found');
  }

  return {
    id: BigInt(row.id),
    sku: row.sku,
    stockQuantity: Number(row.stock_quantity),
  };
}

async function createMovement(tx, data) {
  try {
    return await tx.stockMovement.create({ data, include: movementInclude });
  } catch (error) {
    // Two concurrent requests can pass the pre-check; the unique index is the
    // final guard. Translate it into a 409 instead of a 500.
    if (error && error.code === 'P2002') {
      throw conflict('Reference number has already been used', [
        { field: 'reference_number', message: 'must be unique' },
      ]);
    }

    throw error;
  }
}

async function stockIn({ productId, userId, quantity, referenceNumber = null, notes = null }) {
  assertPositiveInteger(quantity);

  return prisma.$transaction(async (tx) => {
    await assertReferenceAvailable(referenceNumber, tx);

    const product = await lockProductRow(tx, productId);
    const previousStock = product.stockQuantity;
    const newStock = previousStock + quantity;

    assertStockFits(newStock);

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: newStock },
    });

    const movement = await createMovement(tx, {
      productId,
      userId,
      type: 'IN',
      quantity,
      referenceNumber,
      notes,
    });

    return { product: updated, movement, previousStock, newStock };
  }, TRANSACTION_OPTIONS);
}

async function stockOut({ productId, userId, quantity, referenceNumber = null, notes = null }) {
  assertPositiveInteger(quantity);

  return prisma.$transaction(async (tx) => {
    await assertReferenceAvailable(referenceNumber, tx);

    const product = await lockProductRow(tx, productId);
    const previousStock = product.stockQuantity;

    if (previousStock < quantity) {
      throw conflict('Insufficient stock', [
        { field: 'quantity', message: `only ${previousStock} available` },
      ]);
    }

    const newStock = previousStock - quantity;

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: newStock },
    });

    const movement = await createMovement(tx, {
      productId,
      userId,
      type: 'OUT',
      quantity,
      referenceNumber,
      notes,
    });

    return { product: updated, movement, previousStock, newStock };
  }, TRANSACTION_OPTIONS);
}

async function adjustStock({ productId, userId, quantity, referenceNumber = null, notes = null }) {
  // quantity = counted physical stock (stok opname), not the delta.
  assertCountedQuantity(quantity);

  return prisma.$transaction(async (tx) => {
    await assertReferenceAvailable(referenceNumber, tx);

    const product = await lockProductRow(tx, productId);
    const previousStock = product.stockQuantity;
    const delta = quantity - previousStock;

    if (delta === 0) {
      throw conflict('Stock already matches the counted quantity', [
        { field: 'quantity', message: 'no adjustment needed' },
      ]);
    }

    const movementQuantity = Math.abs(delta);
    const direction = delta > 0 ? 'penambahan' : 'pengurangan';
    const detail = `Penyesuaian ${direction}: ${previousStock} -> ${quantity}`;
    const movementNotes = notes ? `${notes} (${detail})` : detail;

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: quantity },
    });

    const movement = await createMovement(tx, {
      productId,
      userId,
      type: 'ADJUSTMENT',
      quantity: movementQuantity,
      referenceNumber,
      notes: movementNotes,
    });

    return { product: updated, movement, previousStock, newStock: quantity, delta };
  }, TRANSACTION_OPTIONS);
}

async function listMovements({ page = 1, limit = 20, productId, type, from, to } = {}) {
  const where = {};

  if (productId) where.productId = productId;
  if (type) where.type = type;

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      include: movementInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { items, total, page, limit };
}

module.exports = {
  listMovements,
  stockIn,
  stockOut,
  adjustStock,
};
