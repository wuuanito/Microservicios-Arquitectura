const { logger } = require('../utils/logger');

// Tipos de errores personalizados
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
};

// Clase de error personalizada
class AppError extends Error {
  constructor(message, statusCode, type = ErrorTypes.INTERNAL_SERVER_ERROR, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Función para crear errores
const createError = (statusCode, message, type) => {
  return new AppError(message, statusCode, type);
};

// Middleware principal de manejo de errores
const errorHandler = (error, req, res, next) => {
  let err = { ...error };
  err.message = error.message;

  // Log del error
  logger.error('Error capturado:', {
    message: err.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Error de validación de Mongoose
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map(val => val.message).join(', ');
    err = createError(400, message, ErrorTypes.VALIDATION_ERROR);
  }

  // Error de duplicado de Mongoose
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    const message = `${field} '${value}' ya existe`;
    err = createError(409, message, ErrorTypes.DUPLICATE_ERROR);
  }

  // Error de cast de Mongoose (ID inválido)
  if (error.name === 'CastError') {
    const message = 'ID de recurso inválido';
    err = createError(400, message, ErrorTypes.VALIDATION_ERROR);
  }

  // Error de JWT
  if (error.name === 'JsonWebTokenError') {
    const message = 'Token de autenticación inválido';
    err = createError(401, message, ErrorTypes.AUTHENTICATION_ERROR);
  }

  // Error de JWT expirado
  if (error.name === 'TokenExpiredError') {
    const message = 'Token de autenticación expirado';
    err = createError(401, message, ErrorTypes.AUTHENTICATION_ERROR);
  }

  // Error de conexión a la base de datos
  if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
    const message = 'Error de conexión a la base de datos';
    err = createError(503, message, ErrorTypes.DATABASE_ERROR);
  }

  // Error de rate limiting
  if (error.type === 'entity.too.large') {
    const message = 'Payload demasiado grande';
    err = createError(413, message, ErrorTypes.VALIDATION_ERROR);
  }

  // Preparar respuesta de error
  const errorResponse = {
    error: err.message || 'Error interno del servidor',
    type: err.type || ErrorTypes.INTERNAL_SERVER_ERROR,
    timestamp: err.timestamp || new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // En desarrollo, incluir stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error;
  }

  // Código de estado por defecto
  const statusCode = err.statusCode || 500;

  // Enviar respuesta de error
  res.status(statusCode).json(errorResponse);
};

// Middleware para manejar errores asíncronos
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware para rutas no encontradas
const notFoundHandler = (req, res, next) => {
  const error = createError(
    404,
    `Ruta ${req.originalUrl} no encontrada`,
    ErrorTypes.NOT_FOUND_ERROR
  );
  next(error);
};

// Middleware para validar JSON
const jsonErrorHandler = (error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    const err = createError(400, 'JSON inválido en el cuerpo de la petición', ErrorTypes.VALIDATION_ERROR);
    return next(err);
  }
  next(error);
};

// Middleware para manejar errores de CORS
const corsErrorHandler = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  if (origin && !allowedOrigins.includes(origin)) {
    const error = createError(
      403,
      'Origen no permitido por política CORS',
      ErrorTypes.AUTHORIZATION_ERROR
    );
    return next(error);
  }
  
  next();
};

// Función para manejar errores no capturados
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Excepción no capturada:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Cerrar servidor gracefully
    process.exit(1);
  });
};

// Función para manejar promesas rechazadas no capturadas
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promesa rechazada no manejada:', {
      reason: reason,
      promise: promise,
      timestamp: new Date().toISOString()
    });
    
    // Cerrar servidor gracefully
    process.exit(1);
  });
};

// Función para configurar manejo global de errores
const setupGlobalErrorHandling = () => {
  handleUncaughtException();
  handleUnhandledRejection();
};

// Middleware para logging de requests
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Override del método end para capturar la respuesta
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    logger.info('Request completado:', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Middleware para validar Content-Type
const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      const error = createError(
        400,
        'Content-Type debe ser application/json',
        ErrorTypes.VALIDATION_ERROR
      );
      return next(error);
    }
  }
  
  next();
};

module.exports = {
  errorHandler,
  asyncErrorHandler,
  notFoundHandler,
  jsonErrorHandler,
  corsErrorHandler,
  requestLogger,
  validateContentType,
  setupGlobalErrorHandling,
  createError,
  AppError,
  ErrorTypes
};