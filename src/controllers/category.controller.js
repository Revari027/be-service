/**
 * Category endpoints (SDD section 7.3).
 */
const categoryService = require('../services/category.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');
const { toCategory } = require('../utils/serializer');

const list = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories({ search: req.query.search });

  return success(res, {
    message: 'Categories retrieved successfully',
    data: {
      items: categories.map(toCategory),
      total: categories.length,
    },
  });
});

const detail = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);

  return success(res, {
    message: 'Category retrieved successfully',
    data: toCategory(category),
  });
});

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);

  return success(res, {
    status: 201,
    message: 'Category created successfully',
    data: toCategory(category),
  });
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);

  return success(res, {
    message: 'Category updated successfully',
    data: toCategory(category),
  });
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);

  return success(res, {
    message: 'Category deleted successfully',
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
