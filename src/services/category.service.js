/**
 * Category business logic (SDD sections 6.1, 6.3 and 7.3).
 */
const prisma = require('../config/database');
const { conflict, notFound } = require('../utils/errors');

const categoryInclude = {
  _count: { select: { products: true } },
};

async function listCategories({ search } = {}) {
  return prisma.category.findMany({
    where: search ? { name: { contains: search } } : {},
    include: categoryInclude,
    orderBy: { name: 'asc' },
  });
}

async function getCategoryById(id) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: categoryInclude,
  });

  if (!category) {
    throw notFound('Category not found');
  }

  return category;
}

async function assertNameAvailable(name, excludedId = null) {
  const existing = await prisma.category.findUnique({ where: { name } });

  if (existing && (excludedId === null || existing.id !== excludedId)) {
    throw conflict('Category name already exists', [
      { field: 'name', message: 'must be unique' },
    ]);
  }
}

async function createCategory({ name, description }) {
  await assertNameAvailable(name);

  return prisma.category.create({
    data: {
      name,
      description: description === undefined ? null : description,
    },
    include: categoryInclude,
  });
}

async function updateCategory(id, payload) {
  await getCategoryById(id);

  if (payload.name !== undefined) {
    await assertNameAvailable(payload.name, id);
  }

  const data = {};

  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description;

  return prisma.category.update({
    where: { id },
    data,
    include: categoryInclude,
  });
}

async function deleteCategory(id) {
  await getCategoryById(id);

  const productsInCategory = await prisma.product.count({ where: { categoryId: id } });

  if (productsInCategory > 0) {
    throw conflict(
      `Category is still used by ${productsInCategory} product(s)`,
      [{ field: 'id', message: 'category still has products' }],
    );
  }

  await prisma.category.delete({ where: { id } });
}

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
