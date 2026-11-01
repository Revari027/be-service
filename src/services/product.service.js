/**
 * Product business logic (SDD sections 6.1 and 7.2).
 *
 * Invariants:
 * - SKU is unique.
 * - The category must exist.
 * - Prices are never negative (enforced by the validator and by the schema).
 * - stock_quantity is never written here; it only changes through the stock
 *   transaction service (SDD principle in section 18).
 * - A product with movement history is never hard-deleted.
 */
const prisma = require('../config/database');
const { conflict, notFound } = require('../utils/errors');

const categorySelect = {
  select: { id: true, name: true },
};

const SORT_FIELDS = {
  name: 'name',
  sku: 'sku',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  stock_quantity: 'stockQuantity',
  selling_price: 'sellingPrice',
  purchase_price: 'purchasePrice',
};

function parseSort(sort = '-created_at') {
  const descending = String(sort).startsWith('-');
  const key = descending ? String(sort).slice(1) : String(sort);

  return { [SORT_FIELDS[key] ?? 'createdAt']: descending ? 'desc' : 'asc' };
}

function buildWhere({ search, categoryId }) {
  const where = {};

  if (search) {
    where.OR = [{ name: { contains: search } }, { sku: { contains: search } }];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  return where;
}

async function listProducts({ page = 1, limit = 20, search, categoryId, sort } = {}) {
  const where = buildWhere({ search, categoryId });
  const skip = (page - 1) * limit;

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: { category: categorySelect },
      orderBy: parseSort(sort),
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, limit };
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: categorySelect },
  });

  if (!product) {
    throw notFound('Product not found');
  }

  return product;
}

async function assertCategoryExists(categoryId) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw notFound('Category not found');
  }
}

async function assertSkuAvailable(sku, excludedId = null) {
  const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });

  if (existing && (excludedId === null || existing.id !== excludedId)) {
    throw conflict('SKU already exists', [{ field: 'sku', message: 'must be unique' }]);
  }
}

async function createProduct(payload) {
  await assertCategoryExists(payload.category_id);
  await assertSkuAvailable(payload.sku);

  return prisma.product.create({
    data: {
      categoryId: payload.category_id,
      sku: payload.sku,
      name: payload.name,
      description: payload.description === undefined ? null : payload.description,
      purchasePrice: payload.purchase_price,
      sellingPrice: payload.selling_price,
      minimumStock: payload.minimum_stock,
      // A new product always starts at zero; stock comes from stock-in.
      stockQuantity: 0,
    },
    include: { category: categorySelect },
  });
}

async function updateProduct(id, payload) {
  await getProductById(id);

  if (payload.category_id !== undefined) {
    await assertCategoryExists(payload.category_id);
  }

  if (payload.sku !== undefined) {
    await assertSkuAvailable(payload.sku, id);
  }

  // Explicit whitelist: stockQuantity can never be set through this path.
  const data = {};

  if (payload.category_id !== undefined) data.categoryId = payload.category_id;
  if (payload.sku !== undefined) data.sku = payload.sku;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.purchase_price !== undefined) data.purchasePrice = payload.purchase_price;
  if (payload.selling_price !== undefined) data.sellingPrice = payload.selling_price;
  if (payload.minimum_stock !== undefined) data.minimumStock = payload.minimum_stock;

  return prisma.product.update({
    where: { id },
    data,
    include: { category: categorySelect },
  });
}

async function deleteProduct(id) {
  await getProductById(id);

  const movementCount = await prisma.stockMovement.count({ where: { productId: id } });

  if (movementCount > 0) {
    throw conflict('Product has stock movements and cannot be deleted', [
      { field: 'id', message: 'product has movement history' },
    ]);
  }

  await prisma.product.delete({ where: { id } });
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
