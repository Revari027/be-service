jest.mock('../../src/config/database', () => ({
  $transaction: jest.fn(),
}));

const prisma = require('../../src/config/database');
const stockService = require('../../src/services/stock.service');

const productId = BigInt(1);
const userId = BigInt(2);

function buildTransaction({ stockQuantity, existingReference = null }) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([
      { id: productId, sku: 'PRD-001', stock_quantity: stockQuantity },
    ]),
    product: {
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: productId,
          sku: 'PRD-001',
          name: 'Laptop ASUS',
          stockQuantity: data.stockQuantity,
        }),
      ),
    },
    stockMovement: {
      findUnique: jest.fn().mockResolvedValue(existingReference),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: BigInt(10),
          productId: data.productId,
          userId: data.userId,
          type: data.type,
          quantity: data.quantity,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          createdAt: new Date(),
        }),
      ),
    },
  };

  prisma.$transaction.mockImplementation(async (callback) => callback(tx));

  return tx;
}

describe('stock-in', () => {
  it('increases the balance and records the movement in one transaction', async () => {
    const tx = buildTransaction({ stockQuantity: 10 });

    const result = await stockService.stockIn({
      productId,
      userId,
      quantity: 20,
      referenceNumber: 'IN-2026-001',
      notes: 'Pembelian supplier',
    });

    expect(result.previousStock).toBe(10);
    expect(result.newStock).toBe(30);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: productId },
      data: { stockQuantity: 30 },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a non positive quantity before touching the database', async () => {
    const tx = buildTransaction({ stockQuantity: 10 });

    await expect(
      stockService.stockIn({ productId, userId, quantity: 0 }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('rejects a reused reference number', async () => {
    const tx = buildTransaction({ stockQuantity: 10, existingReference: { id: BigInt(9) } });

    await expect(
      stockService.stockIn({ productId, userId, quantity: 5, referenceNumber: 'IN-2026-001' }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx.product.update).not.toHaveBeenCalled();
  });
});

describe('stock-out', () => {
  it('decreases the balance', async () => {
    const tx = buildTransaction({ stockQuantity: 50 });

    const result = await stockService.stockOut({
      productId,
      userId,
      quantity: 5,
      referenceNumber: 'OUT-2026-001',
    });

    expect(result.previousStock).toBe(50);
    expect(result.newStock).toBe(45);
    expect(tx.stockMovement.create.mock.calls[0][0].data.type).toBe('OUT');
  });

  it('rejects insufficient stock and never writes a movement', async () => {
    const tx = buildTransaction({ stockQuantity: 3 });

    await expect(
      stockService.stockOut({ productId, userId, quantity: 5 }),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Insufficient stock' });

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});

describe('stock adjustment', () => {
  it('stores the absolute difference against the counted stock', async () => {
    const tx = buildTransaction({ stockQuantity: 12 });

    const result = await stockService.adjustStock({ productId, userId, quantity: 9 });

    expect(result.delta).toBe(-3);
    expect(result.newStock).toBe(9);
    expect(tx.stockMovement.create.mock.calls[0][0].data).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: 3,
    });
    expect(tx.stockMovement.create.mock.calls[0][0].data.notes).toContain('12 -> 9');
  });

  it('rejects an adjustment when the balance already matches', async () => {
    const tx = buildTransaction({ stockQuantity: 9 });

    await expect(
      stockService.adjustStock({ productId, userId, quantity: 9 }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
