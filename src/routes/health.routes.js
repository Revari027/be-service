/**
 * Health endpoints for Kubernetes probes (SDD section 7.6).
 *
 * Liveness never touches the database. Readiness checks connectivity with a
 * short timeout so the Pod is removed from the Service while the dependency is
 * unavailable.
 */
const express = require('express');
const prisma = require('../config/database');

const router = express.Router();

const READY_TIMEOUT_MS = 2000;

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Database readiness check timed out'));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

router.get('/live', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Process is alive',
    data: {
      status: 'live',
      uptime_seconds: Math.floor(process.uptime()),
    },
  });
});

router.get('/ready', async (req, res) => {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, READY_TIMEOUT_MS);

    return res.status(200).json({
      success: true,
      message: 'Application is ready',
      data: {
        status: 'ready',
        database: 'up',
      },
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: 'Application is not ready',
      errors: {
        database: 'down',
      },
    });
  }
});

module.exports = router;
