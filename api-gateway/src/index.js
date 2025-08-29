const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const routeConfig = require('./config/routes');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { errorHandler } = require('./middleware/errorHandler');
const healthCheck = require('./routes/health');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8000;

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
  const proxyOptions = {
    target: route.target,
    changeOrigin: route.changeOrigin || true,
    timeout: route.timeout || 60000,
    ws: route.ws || false, // Habilitar WebSocket si está configurado
    pathRewrite: route.pathRewrite || {},
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${req.originalUrl}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Error en el proxy del servicio'
        });
      }
    },
    onProxyReq: (proxyReq, req, res) => {
      logger.info(`Proxying ${req.method} ${req.originalUrl} -> ${route.target}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.info(`Proxy response: ${proxyRes.statusCode} for ${req.originalUrl}`);
    }
  };

  app.use(route.path, createProxyMiddleware(proxyOptions));
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

// Crear servidor HTTP para soportar WebSockets
const http = require('http');
const server = http.createServer(app);

// Configurar upgrade para WebSockets
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  // Buscar ruta que coincida con WebSocket
  const wsRoute = routeConfig.routes.find(route => 
    route.ws && pathname.startsWith(route.path)
  );
  
  if (wsRoute) {
    logger.info(`WebSocket upgrade: ${pathname} -> ${wsRoute.target}`);
    
    // Crear proxy para WebSocket
    const wsProxy = createProxyMiddleware({
      target: wsRoute.target,
      changeOrigin: true,
      ws: true,
      pathRewrite: wsRoute.pathRewrite || {}
    });
    
    wsProxy.upgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`🚀 API Gateway iniciado en puerto ${PORT}`);
  logger.info(`📋 Rutas configuradas: ${routeConfig.routes.length}`);
  routeConfig.routes.forEach(route => {
    logger.info(`   ${route.path} -> ${route.target} ${route.ws ? '(WebSocket)' : ''}`);
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