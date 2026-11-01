/**
 * Jest bootstrap. Values here are test-only defaults so the suite never needs a
 * real .env file; integration tests opt in explicitly through
 * RUN_INTEGRATION_TESTS and a reachable MySQL test database.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret-please-change';
process.env.DB_USER = process.env.DB_USER || 'inventory_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';
process.env.DB_NAME = process.env.DB_NAME || 'inventory_db';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

jest.setTimeout(30000);
