const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const routeConfig = require('./config/routes');
const axios = require('axios');
const { errorHandler } = require('./middleware/errorHandler');
const healthCheck = require('./routes/health');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy configuration for rate limiting
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // límite de 1000 requests por ventana por IP
  message: {
    error: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware básico
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Health check endpoint
app.use('/health', healthCheck);

// Configurar rutas de proxy para microservicios
routeConfig.routes.forEach(route => {
  app.use(route.path, async (req, res, next) => {
    try {
      // Apply path rewriting
      let targetPath = req.originalUrl;
      if (route.pathRewrite) {
        Object.keys(route.pathRewrite).forEach(pattern => {
          const regex = new RegExp(pattern);
          if (regex.test(req.originalUrl)) {
            targetPath = req.originalUrl.replace(regex, route.pathRewrite[pattern]);
          }
        });
      }

      const targetUrl = route.target + targetPath;
      logger.info(`Proxying ${req.method} ${req.originalUrl} -> ${targetUrl}`);

      // Make request using axios
      const axiosConfig = {
        method: req.method,
        url: targetUrl,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        },
        timeout: 10000
      };

      // Add body for POST/PUT/PATCH requests
      if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        axiosConfig.data = req.body;
      }

      const response = await axios(axiosConfig);
      
      logger.info(`Proxy response: ${response.status} for ${req.originalUrl}`);
      
      // Send response
      res.status(response.status).json(response.data);
      
    } catch (error) {
      logger.error(`Proxy error for ${req.originalUrl}:`, error.message);
      
      if (error.response) {
        // The request was made and the server responded with a status code outside 2xx
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNABORTED') {
        // Request timeout
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Request timed out'
        });
      } else {
        // Something else happened
        res.status(502).json({
          error: 'Bad Gateway',
          message: error.message
        });
      }
    }
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

// Ruta por defecto
app.get('/', (req, res) => {
  res.json({
    message: 'API Gateway funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: routeConfig.routes.map(route => ({
      path: route.path,
      service: route.target,
      description: route.description
    }))
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`🚀 API Gateway iniciado en puerto ${PORT}`);
  logger.info(`📋 Rutas configuradas: ${routeConfig.routes.length}`);
  routeConfig.routes.forEach(route => {
    logger.info(`   ${route.path} -> ${route.target}`);
  });
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

module.exports = app;