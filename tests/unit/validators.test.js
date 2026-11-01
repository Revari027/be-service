const {
  createProductSchema,
  updateProductSchema,
} = require('../../src/validators/product.validator');
const {
  stockInSchema,
  stockOutSchema,
  stockAdjustmentSchema,
} = require('../../src/validators/stock.validator');

const validProduct = {
  category_id: 1,
  sku: 'PRD-001',
  name: 'Laptop ASUS',
  description: 'Laptop untuk kebutuhan kantor',
  purchase_price: 7500000,
  selling_price: 8500000,
  minimum_stock: 5,
};

function messages(result) {
  return result.error.issues.map((issue) => issue.message).join(' | ');
}

describe('product validation', () => {
  it('accepts a valid payload and normalizes ids to BigInt', () => {
    const result = createProductSchema.safeParse(validProduct);

    expect(result.success).toBe(true);
    expect(result.data.category_id).toBe(BigInt(1));
    expect(result.data.purchase_price).toBe(7500000);
  });

  it('rejects stock_quantity on create so stock can only move through /stock', () => {
    const result = createProductSchema.safeParse({ ...validProduct, stock_quantity: 10 });

    expect(result.success).toBe(false);
    expect(messages(result)).toContain('stock_quantity');
  });

  it('rejects negative prices', () => {
    const result = createProductSchema.safeParse({ ...validProduct, purchase_price: -1 });

    expect(result.success).toBe(false);
  });

  it('rejects a non positive category id', () => {
    const result = createProductSchema.safeParse({ ...validProduct, category_id: 0 });

    expect(result.success).toBe(false);
  });

  it('applies defaults for prices, minimum stock and description', () => {
    const result = createProductSchema.safeParse({
      category_id: 2,
      sku: 'PRD-002',
      name: 'Mouse',
    });

    expect(result.success).toBe(true);
    expect(result.data.purchase_price).toBe(0);
    expect(result.data.selling_price).toBe(0);
    expect(result.data.minimum_stock).toBe(5);
    expect(result.data.description).toBeUndefined();
  });

  it('rejects an empty update payload', () => {
    const result = updateProductSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(messages(result)).toContain('At least one field must be provided');
  });

  it('rejects stock_quantity on update', () => {
    const result = updateProductSchema.safeParse({ stock_quantity: 99 });

    expect(result.success).toBe(false);
    expect(messages(result)).toContain('stock_quantity');
  });
});

describe('stock validation', () => {
  it('accepts a valid stock-in payload', () => {
    const result = stockInSchema.safeParse({
      product_id: 1,
      quantity: 20,
      reference_number: 'IN-2026-001',
      notes: 'Pembelian supplier',
    });

    expect(result.success).toBe(true);
    expect(result.data.product_id).toBe(BigInt(1));
  });

  it('rejects a zero quantity for stock-in', () => {
    const result = stockInSchema.safeParse({ product_id: 1, quantity: 0 });

    expect(result.success).toBe(false);
  });

  it('rejects a negative quantity for stock-out', () => {
    const result = stockOutSchema.safeParse({ product_id: 1, quantity: -5 });

    expect(result.success).toBe(false);
  });

  it('allows zero counted quantity for an adjustment', () => {
    const result = stockAdjustmentSchema.safeParse({ product_id: 1, quantity: 0 });

    expect(result.success).toBe(true);
    expect(result.data.quantity).toBe(0);
  });

  it('rejects a reference number longer than 100 characters', () => {
    const result = stockInSchema.safeParse({
      product_id: 1,
      quantity: 1,
      reference_number: 'X'.repeat(101),
    });

    expect(result.success).toBe(false);
  });
});
