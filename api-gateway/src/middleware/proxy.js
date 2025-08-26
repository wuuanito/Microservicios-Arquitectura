const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const logger = require('../utils/logger');

// Circuit breaker simple
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000, resetTimeout = 30000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker: Intentando cerrar circuito');
      } else {
        throw new Error('Circuit breaker está abierto');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker abierto después de ${this.failureCount} fallos`);
    }
  }
}

// Almacenar circuit breakers por servicio
const circuitBreakers = new Map();

// Función para obtener o crear circuit breaker
function getCircuitBreaker(target) {
  if (!circuitBreakers.has(target)) {
    circuitBreakers.set(target, new CircuitBreaker());
  }
  return circuitBreakers.get(target);
}

// Función para verificar salud del servicio
async function checkServiceHealth(target, healthPath = '/health') {
  try {
    const response = await axios.get(`${target}${healthPath}`, {
      timeout: 5000,
      validateStatus: (status) => status < 500
    });
    return response.status < 400;
  } catch (error) {
    logger.warn(`Health check falló para ${target}: ${error.message}`);
    return false;
  }
}

// Middleware de retry con backoff exponencial
function createRetryMiddleware(retries = 3, baseDelay = 1000) {
  return async (proxyReq, proxyRes, req, res, next) => {
    let attempt = 0;
    
    const executeWithRetry = async () => {
      try {
        return await next();
      } catch (error) {
        attempt++;
        
        if (attempt <= retries && isRetryableError(error)) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          logger.warn(`Reintentando petición ${req.method} ${req.originalUrl} (intento ${attempt}/${retries}) en ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetry();
        }
        
        throw error;
      }
    };
    
    return executeWithRetry();
  };
}

// Verificar si el error es reintentable
function isRetryableError(error) {
  if (!error.response) return true; // Error de red
  
  const status = error.response.status;
  return status >= 500 || status === 408 || status === 429;
}

// Crear middleware de proxy para una ruta específica
function createProxyForRoute(routeConfig) {
  const circuitBreaker = getCircuitBreaker(routeConfig.target);
  
  const proxyOptions = {
    target: routeConfig.target,
    changeOrigin: routeConfig.changeOrigin || true,
    pathRewrite: routeConfig.pathRewrite || {},
    timeout: routeConfig.timeout || 30000,
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Headers personalizados
    onProxyReq: (proxyReq, req, res) => {
      // Agregar headers de identificación
      proxyReq.setHeader('X-Forwarded-For', req.ip);
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
      proxyReq.setHeader('X-Forwarded-Host', req.get('host'));
      proxyReq.setHeader('X-API-Gateway', 'true');
      proxyReq.setHeader('X-Request-ID', req.id || generateRequestId());
      
      // Log de la petición
      logger.info(`Proxy: ${req.method} ${req.originalUrl} -> ${routeConfig.target}${proxyReq.path}`);
    },
    
    // Manejo de respuestas
    onProxyRes: (proxyRes, req, res) => {
      // Agregar headers de respuesta
      proxyRes.headers['X-Served-By'] = 'API-Gateway';
      proxyRes.headers['X-Response-Time'] = Date.now() - req.startTime;
      
      logger.info(`Proxy Response: ${proxyRes.statusCode} para ${req.method} ${req.originalUrl}`);
    },
    
    // Manejo de errores
    onError: (err, req, res) => {
      logger.error(`Proxy Error: ${err.message} para ${req.method} ${req.originalUrl}`);
      
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Error del gateway',
          message: 'El servicio no está disponible temporalmente',
          service: routeConfig.target,
          timestamp: new Date().toISOString(),
          requestId: req.id
        });
      }
    }
  };
  
  const proxy = createProxyMiddleware(proxyOptions);
  
  // Simplified wrapper without circuit breaker (temporary)
  return (req, res, next) => {
    req.startTime = Date.now();
    req.id = req.id || generateRequestId();
    
    // Direct proxy without circuit breaker or health checks
    proxy(req, res, next);
  };
}

// Generar ID único para la petición
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = createProxyForRoute;