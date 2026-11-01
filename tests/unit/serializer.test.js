const {
  bigintReplacer,
  toPagination,
  toProduct,
  toUser,
} = require('../../src/utils/serializer');

function decimal(value) {
  return { toString: () => value.toFixed(2) };
}

const baseProduct = {
  id: BigInt(1),
  categoryId: BigInt(2),
  sku: 'PRD-001',
  name: 'Laptop ASUS',
  description: null,
  purchasePrice: decimal(7500000),
  sellingPrice: decimal(8500000),
  stockQuantity: 3,
  minimumStock: 5,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('product serialization', () => {
  it('converts BigInt ids and Decimal values to strings', () => {
    const product = toProduct(baseProduct);

    expect(product.id).toBe('1');
    expect(product.category_id).toBe('2');
    expect(product.purchase_price).toBe('7500000.00');
  });

  it('flags a product as low stock when the balance is at or below the minimum', () => {
    expect(toProduct(baseProduct).is_low_stock).toBe(true);
    expect(toProduct({ ...baseProduct, stockQuantity: 6 }).is_low_stock).toBe(false);
    expect(toProduct({ ...baseProduct, stockQuantity: 5 }).is_low_stock).toBe(true);
  });
});

describe('user serialization', () => {
  it('never exposes the password hash', () => {
    const user = toUser({
      id: BigInt(1),
      name: 'Administrator',
      email: 'admin@example.com',
      role: 'ADMIN',
      passwordHash: 'secret-hash',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user.id).toBe('1');
  });
});

describe('json replacer', () => {
  it('serializes BigInt values inside JSON.stringify', () => {
    const json = JSON.stringify({ id: BigInt(5) }, bigintReplacer);

    expect(json).toBe('{"id":"5"}');
  });
});

describe('pagination metadata', () => {
  it('computes total pages and navigation flags', () => {
    const pagination = toPagination({ page: 2, limit: 10, total: 25 });

    expect(pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      total_pages: 3,
      has_next_page: true,
      has_previous_page: true,
    });
  });
});
