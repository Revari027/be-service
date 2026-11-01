/**
 * Response serializers.
 *
 * JSON.stringify cannot handle BigInt, so every BIGINT id is converted to a
 * string before leaving the process (SDD section 7.7). Prisma Decimal values are
 * also converted to strings to keep the monetary precision intact.
 */
function bigintReplacer(key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function toId(value) {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function toDecimalString(value) {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toUser(user) {
  if (!user) return null;

  // password_hash is never exposed through the API (SDD section 15.3).
  return {
    id: toId(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: toIsoString(user.createdAt),
    updated_at: toIsoString(user.updatedAt),
  };
}

function toCategory(category) {
  if (!category) return null;

  const payload = {
    id: toId(category.id),
    name: category.name,
    description: category.description ?? null,
    created_at: toIsoString(category.createdAt),
    updated_at: toIsoString(category.updatedAt),
  };

  if (category._count && typeof category._count.products === 'number') {
    payload.product_count = category._count.products;
  }

  return payload;
}

function toProduct(product) {
  if (!product) return null;

  const payload = {
    id: toId(product.id),
    category_id: toId(product.categoryId),
    sku: product.sku,
    name: product.name,
    description: product.description ?? null,
    purchase_price: toDecimalString(product.purchasePrice),
    selling_price: toDecimalString(product.sellingPrice),
    stock_quantity: product.stockQuantity,
    minimum_stock: product.minimumStock,
    is_low_stock: Number(product.stockQuantity) <= Number(product.minimumStock),
    created_at: toIsoString(product.createdAt),
    updated_at: toIsoString(product.updatedAt),
  };

  if (product.category) {
    payload.category = {
      id: toId(product.category.id),
      name: product.category.name,
    };
  }

  return payload;
}

function toStockMovement(movement) {
  if (!movement) return null;

  const payload = {
    id: toId(movement.id),
    product_id: toId(movement.productId),
    user_id: toId(movement.userId),
    type: movement.type,
    quantity: movement.quantity,
    reference_number: movement.referenceNumber ?? null,
    notes: movement.notes ?? null,
    created_at: toIsoString(movement.createdAt),
  };

  if (movement.product) {
    payload.product = {
      id: toId(movement.product.id),
      sku: movement.product.sku,
      name: movement.product.name,
    };
  }

  if (movement.user) {
    payload.user = {
      id: toId(movement.user.id),
      name: movement.user.name,
    };
  }

  return payload;
}

function toPagination({ page, limit, total }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    page,
    limit,
    total,
    total_pages: totalPages,
    has_next_page: page < totalPages,
    has_previous_page: page > 1,
  };
}

module.exports = {
  bigintReplacer,
  toId,
  toDecimalString,
  toIsoString,
  toUser,
  toCategory,
  toProduct,
  toStockMovement,
  toPagination,
};
