/**
 * Single PrismaClient instance for the whole process (SDD section 9.2).
 * Connections are closed gracefully by src/server.js on shutdown.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

module.exports = prisma;
