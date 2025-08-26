const winston = require('winston');
const path = require('path');

// Configuración de colores para los niveles
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Formato para consola
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.align(),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Crear directorio de logs si no existe
const logsDir = path.join(process.cwd(), 'logs');

// Configuración de transports
const transports = [
  // Archivo para todos los logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Archivo solo para errores
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Archivo para logs de autenticación
  new winston.transports.File({
    filename: path.join(logsDir, 'auth.log'),
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    level: 'info'
  }),
  
  // Archivo para logs de seguridad
  new winston.transports.File({
    filename: path.join(logsDir, 'security.log'),
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    level: 'warn'
  })
];

// Agregar consola en desarrollo
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

// Crear logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'auth-service',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports,
  
  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat
    })
  ],
  
  // Manejar promesas rechazadas
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat
    })
  ],
  
  exitOnError: false
});

// Logger específico para autenticación
const authLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.label({ label: 'AUTH' })
  ),
  defaultMeta: {
    service: 'auth-service',
    category: 'authentication'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'auth.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Logger específico para seguridad
const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.label({ label: 'SECURITY' })
  ),
  defaultMeta: {
    service: 'auth-service',
    category: 'security'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Logger específico para performance
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.label({ label: 'PERFORMANCE' })
  ),
  defaultMeta: {
    service: 'auth-service',
    category: 'performance'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Funciones de utilidad para logging
const logAuth = (message, meta = {}) => {
  authLogger.info(message, {
    ...meta,
    timestamp: new Date().toISOString()
  });
};

const logSecurity = (message, meta = {}) => {
  securityLogger.warn(message, {
    ...meta,
    timestamp: new Date().toISOString(),
    severity: 'high'
  });
};

const logPerformance = (message, meta = {}) => {
  performanceLogger.info(message, {
    ...meta,
    timestamp: new Date().toISOString()
  });
};

const logLoginAttempt = (email, success, ip, userAgent, meta = {}) => {
  const logData = {
    email,
    success,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    ...meta
  };
  
  if (success) {
    authLogger.info('Login exitoso', logData);
  } else {
    securityLogger.warn('Intento de login fallido', logData);
  }
};

const logRegistration = (email, ip, userAgent, meta = {}) => {
  authLogger.info('Usuario registrado', {
    email,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    ...meta
  });
};

const logPasswordChange = (userId, email, ip, meta = {}) => {
  securityLogger.warn('Contraseña cambiada', {
    userId,
    email,
    ip,
    timestamp: new Date().toISOString(),
    ...meta
  });
};

const logSuspiciousActivity = (activity, userId, ip, meta = {}) => {
  securityLogger.error('Actividad sospechosa detectada', {
    activity,
    userId,
    ip,
    timestamp: new Date().toISOString(),
    severity: 'critical',
    ...meta
  });
};

const logApiCall = (method, endpoint, statusCode, duration, userId, ip, meta = {}) => {
  const logData = {
    method,
    endpoint,
    statusCode,
    duration,
    userId,
    ip,
    timestamp: new Date().toISOString(),
    ...meta
  };
  
  if (statusCode >= 400) {
    logger.warn('API call con error', logData);
  } else {
    logger.info('API call exitoso', logData);
  }
  
  // Log de performance para calls lentos
  if (duration > 1000) {
    performanceLogger.warn('API call lento', logData);
  }
};

const logDatabaseOperation = (operation, collection, duration, success, meta = {}) => {
  const logData = {
    operation,
    collection,
    duration,
    success,
    timestamp: new Date().toISOString(),
    ...meta
  };
  
  if (success) {
    logger.debug('Operación de BD exitosa', logData);
  } else {
    logger.error('Error en operación de BD', logData);
  }
  
  // Log de performance para operaciones lentas
  if (duration > 500) {
    performanceLogger.warn('Operación de BD lenta', logData);
  }
};

// Middleware para logging de requests HTTP
const httpLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'auth-service',
    category: 'http'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Stream para Morgan (HTTP logging)
const morganStream = {
  write: (message) => {
    httpLogger.info(message.trim());
  }
};

// Función para crear contexto de logging
const createLogContext = (req) => {
  return {
    requestId: req.id || 'unknown',
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  logger,
  authLogger,
  securityLogger,
  performanceLogger,
  httpLogger,
  morganStream,
  
  // Funciones de utilidad
  logAuth,
  logSecurity,
  logPerformance,
  logLoginAttempt,
  logRegistration,
  logPasswordChange,
  logSuspiciousActivity,
  logApiCall,
  logDatabaseOperation,
  createLogContext
};