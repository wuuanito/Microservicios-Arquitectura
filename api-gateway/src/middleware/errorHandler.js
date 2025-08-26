const logger = require('../utils/logger');

// Middleware de manejo de errores global
function errorHandler(err, req, res, next) {
  // Log del error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    timestamp: new Date().toISOString()
  });

  // Si ya se enviaron headers, delegar al manejador por defecto de Express
  if (res.headersSent) {
    return next(err);
  }

  // Determinar código de estado y mensaje
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let details = null;

  // Errores específicos
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Error de validación';
    details = err.details;
  } else if (err.name === 'UnauthorizedError' || err.message.includes('unauthorized')) {
    statusCode = 401;
    message = 'No autorizado';
  } else if (err.name === 'ForbiddenError' || err.message.includes('forbidden')) {
    statusCode = 403;
    message = 'Acceso prohibido';
  } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
    statusCode = 404;
    message = 'Recurso no encontrado';
  } else if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
    statusCode = 408;
    message = 'Tiempo de espera agotado';
  } else if (err.name === 'TooManyRequestsError' || err.message.includes('rate limit')) {
    statusCode = 429;
    message = 'Demasiadas peticiones';
  } else if (err.name === 'BadGatewayError' || err.message.includes('bad gateway')) {
    statusCode = 502;
    message = 'Error del gateway';
  } else if (err.name === 'ServiceUnavailableError' || err.message.includes('service unavailable')) {
    statusCode = 503;
    message = 'Servicio no disponible';
  } else if (err.name === 'GatewayTimeoutError' || err.message.includes('gateway timeout')) {
    statusCode = 504;
    message = 'Tiempo de espera del gateway agotado';
  } else if (err.statusCode || err.status) {
    statusCode = err.statusCode || err.status;
    message = err.message || message;
  }

  // Respuesta de error estructurada
  const errorResponse = {
    error: {
      code: statusCode,
      message: message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      requestId: req.id
    }
  };

  // Agregar detalles adicionales en desarrollo
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = details || err.message;
    errorResponse.error.stack = err.stack;
  }

  // Agregar información específica según el tipo de error
  if (statusCode >= 500) {
    errorResponse.error.type = 'INTERNAL_ERROR';
    errorResponse.error.suggestion = 'Por favor, intenta de nuevo más tarde o contacta al soporte técnico';
  } else if (statusCode >= 400) {
    errorResponse.error.type = 'CLIENT_ERROR';
    errorResponse.error.suggestion = 'Verifica los datos enviados y vuelve a intentar';
  }

  // Headers de respuesta
  res.set({
    'Content-Type': 'application/json',
    'X-Error-Code': statusCode,
    'X-Request-ID': req.id
  });

  // Enviar respuesta
  res.status(statusCode).json(errorResponse);
}

// Middleware para capturar errores asíncronos
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Middleware para errores 404
function notFoundHandler(req, res, next) {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.name = 'NotFoundError';
  error.statusCode = 404;
  next(error);
}

// Función para crear errores personalizados
function createError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

// Tipos de errores comunes
const ErrorTypes = {
  VALIDATION_ERROR: 'ValidationError',
  UNAUTHORIZED_ERROR: 'UnauthorizedError',
  FORBIDDEN_ERROR: 'ForbiddenError',
  NOT_FOUND_ERROR: 'NotFoundError',
  TIMEOUT_ERROR: 'TimeoutError',
  RATE_LIMIT_ERROR: 'TooManyRequestsError',
  BAD_GATEWAY_ERROR: 'BadGatewayError',
  SERVICE_UNAVAILABLE_ERROR: 'ServiceUnavailableError',
  GATEWAY_TIMEOUT_ERROR: 'GatewayTimeoutError'
};

module.exports = {
  errorHandler,
  asyncErrorHandler,
  notFoundHandler,
  createError,
  ErrorTypes
};