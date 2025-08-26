const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../utils/logger');
const { createError, ErrorTypes } = require('./errorHandler');

// Cache para tokens validados (simple cache en memoria)
const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Middleware de autenticación JWT
function authenticateToken(options = {}) {
  const {
    required = true,
    roles = [],
    skipPaths = [],
    authServiceUrl = process.env.AUTH_SERVICE_URL
  } = options;

  return async (req, res, next) => {
    try {
      // Verificar si la ruta debe ser omitida
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Extraer token del header Authorization
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;

      // Si no hay token y es requerido
      if (!token && required) {
        return next(createError(401, 'Token de acceso requerido'));
      }

      // Si no hay token pero no es requerido, continuar
      if (!token && !required) {
        return next();
      }

      // Verificar cache primero
      const cachedData = tokenCache.get(token);
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
        req.user = cachedData.user;
        req.token = token;
        return next();
      }

      // Validar token localmente primero (verificación básica)
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: false });
      } catch (jwtError) {
        logger.warn('Token JWT inválido', { 
          error: jwtError.message, 
          token: token.substring(0, 20) + '...',
          ip: req.ip 
        });
        return next(createError(401, 'Token inválido'));
      }

      // Validar con el servicio de autenticación si está disponible
      if (authServiceUrl) {
        try {
          const validationResponse = await validateTokenWithAuthService(token, authServiceUrl);
          
          if (!validationResponse.valid) {
            return next(createError(401, 'Token no válido en el servicio de autenticación'));
          }

          // Usar datos del servicio de autenticación si están disponibles
          req.user = validationResponse.user || decoded;
        } catch (authServiceError) {
          logger.warn('Error al validar token con servicio de autenticación', {
            error: authServiceError.message,
            authServiceUrl,
            fallbackToLocal: true
          });
          
          // Fallback a validación local si el servicio no está disponible
          req.user = decoded;
        }
      } else {
        // Solo validación local
        req.user = decoded;
      }

      // Verificar roles si se especifican
      if (roles.length > 0 && !hasRequiredRole(req.user, roles)) {
        return next(createError(403, 'Permisos insuficientes'));
      }

      // Guardar en cache
      tokenCache.set(token, {
        user: req.user,
        timestamp: Date.now()
      });

      // Agregar token a la request
      req.token = token;

      // Agregar headers para el microservicio
      req.headers['x-user-id'] = req.user.id || req.user.userId;
      req.headers['x-user-email'] = req.user.email;
      req.headers['x-user-roles'] = JSON.stringify(req.user.roles || []);
      req.headers['x-authenticated'] = 'true';

      next();
    } catch (error) {
      logger.error('Error en middleware de autenticación', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      next(createError(500, 'Error interno de autenticación'));
    }
  };
}

// Validar token con el servicio de autenticación
async function validateTokenWithAuthService(token, authServiceUrl) {
  try {
    const response = await axios.post(
      `${authServiceUrl}/validate-token`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    return {
      valid: response.status === 200,
      user: response.data.user || null
    };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return { valid: false, user: null };
    }
    throw error;
  }
}

// Verificar si el usuario tiene los roles requeridos
function hasRequiredRole(user, requiredRoles) {
  if (!user.roles || !Array.isArray(user.roles)) {
    return false;
  }

  return requiredRoles.some(role => 
    user.roles.includes(role) || 
    user.roles.some(userRole => userRole.name === role)
  );
}

// Middleware para rutas que requieren roles específicos
function requireRole(...roles) {
  return authenticateToken({ required: true, roles });
}

// Middleware para rutas opcionales (no requieren autenticación)
function optionalAuth(options = {}) {
  return authenticateToken({ required: false, ...options });
}

// Middleware para verificar permisos específicos
function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'Autenticación requerida'));
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = userPermissions.includes(permission) ||
                         userPermissions.some(p => p.name === permission);

    if (!hasPermission) {
      return next(createError(403, `Permiso requerido: ${permission}`));
    }

    next();
  };
}

// Limpiar cache periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      tokenCache.delete(token);
    }
  }
}, CACHE_TTL);

// Función para limpiar cache manualmente
function clearTokenCache() {
  tokenCache.clear();
  logger.info('Cache de tokens limpiado');
}

// Función para obtener estadísticas del cache
function getCacheStats() {
  return {
    size: tokenCache.size,
    ttl: CACHE_TTL,
    entries: Array.from(tokenCache.entries()).map(([token, data]) => ({
      tokenPreview: token.substring(0, 20) + '...',
      userId: data.user.id || data.user.userId,
      timestamp: data.timestamp,
      age: Date.now() - data.timestamp
    }))
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
  requirePermission,
  clearTokenCache,
  getCacheStats,
  validateTokenWithAuthService
};