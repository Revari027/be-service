/**
 * Product endpoints (SDD section 7.2).
 */
const productService = require('../services/product.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');
const { toPagination, toProduct } = require('../utils/serializer');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, category_id: categoryId, sort } = req.query;
  const result = await productService.listProducts({ page, limit, search, categoryId, sort });

  return success(res, {
    message: 'Products retrieved successfully',
    data: {
      items: result.items.map(toProduct),
      pagination: toPagination({ page: result.page, limit: result.limit, total: result.total }),
    },
  });
});

const detail = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);

  return success(res, {
    message: 'Product retrieved successfully',
    data: toProduct(product),
  });
});

const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);

  return success(res, {
    status: 201,
    message: 'Product created successfully',
    data: toProduct(product),
  });
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);

  return success(res, {
    message: 'Product updated successfully',
    data: toProduct(product),
  });
});

const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);

  return success(res, {
    message: 'Product deleted successfully',
    data: null,
  });
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
