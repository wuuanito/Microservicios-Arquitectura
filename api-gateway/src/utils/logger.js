const fs = require('fs');
const path = require('path');

// Niveles de log
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Colores para consola
const COLORS = {
  ERROR: '\x1b[31m', // Rojo
  WARN: '\x1b[33m',  // Amarillo
  INFO: '\x1b[36m',  // Cian
  DEBUG: '\x1b[37m', // Blanco
  RESET: '\x1b[0m'
};

class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  getLogLevel() {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...meta,
      pid: process.pid,
      hostname: require('os').hostname()
    };

    return logEntry;
  }

  writeToFile(level, logEntry) {
    const fileName = `${new Date().toISOString().split('T')[0]}.log`;
    const filePath = path.join(this.logDir, fileName);
    const logLine = JSON.stringify(logEntry) + '\n';

    fs.appendFileSync(filePath, logLine);

    // Archivo separado para errores
    if (level === 'ERROR') {
      const errorFileName = `error-${new Date().toISOString().split('T')[0]}.log`;
      const errorFilePath = path.join(this.logDir, errorFileName);
      fs.appendFileSync(errorFilePath, logLine);
    }
  }

  writeToConsole(level, logEntry) {
    const color = COLORS[level] || COLORS.RESET;
    const resetColor = COLORS.RESET;
    
    const consoleMessage = `${color}[${logEntry.timestamp}] ${level}: ${logEntry.message}${resetColor}`;
    
    if (level === 'ERROR') {
      console.error(consoleMessage);
      if (logEntry.stack) {
        console.error(`${color}Stack: ${logEntry.stack}${resetColor}`);
      }
    } else if (level === 'WARN') {
      console.warn(consoleMessage);
    } else {
      console.log(consoleMessage);
    }

    // Mostrar metadata adicional en desarrollo
    if (process.env.NODE_ENV === 'development' && Object.keys(logEntry).length > 5) {
      const meta = { ...logEntry };
      delete meta.timestamp;
      delete meta.level;
      delete meta.message;
      delete meta.pid;
      delete meta.hostname;
      
      if (Object.keys(meta).length > 0) {
        console.log(`${color}Meta:${resetColor}`, meta);
      }
    }
  }

  log(level, message, meta = {}) {
    const levelValue = LOG_LEVELS[level];
    
    if (levelValue > this.logLevel) {
      return; // No loggear si el nivel es menor al configurado
    }

    const logEntry = this.formatMessage(level, message, meta);

    // Escribir a consola
    this.writeToConsole(level, logEntry);

    // Escribir a archivo en producción
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(level, logEntry);
    }
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  // Método para loggear peticiones HTTP
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      contentLength: res.get('Content-Length') || 0
    };

    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    this.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`, logData);
  }

  // Método para loggear errores de proxy
  logProxyError(error, req, target) {
    this.error('Proxy Error', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.originalUrl,
      target: target,
      requestId: req.id,
      ip: req.ip
    });
  }

  // Método para loggear métricas del sistema
  logSystemMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.info('System Metrics', {
      memory: {
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: `${Math.round(process.uptime())}s`
    });
  }

  // Limpiar logs antiguos
  cleanOldLogs(daysToKeep = 30) {
    if (!fs.existsSync(this.logDir)) return;

    const files = fs.readdirSync(this.logDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    files.forEach(file => {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        this.info(`Log file deleted: ${file}`);
      }
    });
  }
}

// Crear instancia singleton
const logger = new Logger();

// Limpiar logs antiguos al iniciar (solo en producción)
if (process.env.NODE_ENV === 'production') {
  logger.cleanOldLogs();
  
  // Programar limpieza diaria
  setInterval(() => {
    logger.cleanOldLogs();
  }, 24 * 60 * 60 * 1000); // 24 horas
}

// Loggear métricas del sistema cada 5 minutos en desarrollo
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    logger.logSystemMetrics();
  }, 5 * 60 * 1000); // 5 minutos
}

module.exports = logger;