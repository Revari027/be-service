/**
 * Dashboard routes (SDD section 7.5).
 */
const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/summary', dashboardController.summary);
router.get('/low-stock', dashboardController.lowStock);
router.get('/recent-movements', dashboardController.recentMovements);

module.exports = router;
