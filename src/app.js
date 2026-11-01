/**
 * Express application (SDD sections 7 and 9).
 *
 * request -> security middleware -> cookie parsing -> CSRF -> routes ->
 * controllers -> services -> Prisma
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { csrfProtection } = require('./middlewares/auth.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const { AppError } = require('./utils/errors');
const { bigintReplacer } = require('./utils/serializer');

const authRoutes = require('./routes/auth.routes');
const categoryRoutes = require('./routes/category.routes');
const productRoutes = require('./routes/product.routes');
const stockRoutes = require('./routes/stock.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.disable('x-powered-by');
// The service runs behind the GKE Ingress / Google Cloud Load Balancer.
app.set('trust proxy', 1);
// BIGINT ids are serialized as strings for every JSON response.
app.set('json replacer', bigintReplacer);

app.use(helmet());

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Same-origin, server to server calls and probes send no Origin header.
      if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new AppError('Origin not allowed by CORS', 403));
    },
  }),
);

// Bounded payloads to reject oversized requests early.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// Health checks stay outside the general API limiter and never require auth.
app.use('/api/v1/health', healthRoutes);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    errors: null,
  },
});

app.use('/api/v1', apiLimiter, csrfProtection);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/stock', stockRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
