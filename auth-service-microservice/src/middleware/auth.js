const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

// Middleware de autenticación
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        message: 'Debes proporcionar un token de autenticación válido'
      });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Buscar usuario
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Usuario no encontrado o inactivo'
      });
    }

    // Verificar si la cuenta está bloqueada
    if (user.isLocked) {
      return res.status(423).json({
        error: 'Cuenta bloqueada',
        message: 'Cuenta temporalmente bloqueada'
      });
    }

    // Agregar usuario a la request
    req.user = user;
    req.token = token;
    
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Token de autenticación inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Token de autenticación expirado'
      });
    }
    
    logger.error('Error en middleware de autenticación:', error);
    next(createError(500, 'Error interno del servidor'));
  }
};

// Middleware para verificar rol de administrador
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      message: 'Debes estar autenticado para acceder a este recurso'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Necesitas permisos de administrador para acceder a este recurso'
    });
  }

  next();
};

// Middleware para verificar rol de moderador o superior
const moderatorMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      message: 'Debes estar autenticado para acceder a este recurso'
    });
  }

  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Necesitas permisos de moderador o administrador para acceder a este recurso'
    });
  }

  next();
};

// Middleware para verificar que el usuario es el propietario del recurso o admin
const ownerOrAdminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      message: 'Debes estar autenticado para acceder a este recurso'
    });
  }

  const resourceUserId = req.params.userId || req.params.id;
  const isOwner = req.user._id.toString() === resourceUserId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Solo puedes acceder a tus propios recursos o ser administrador'
    });
  }

  next();
};

// Middleware opcional de autenticación (no falla si no hay token)
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continuar sin usuario autenticado
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive && !user.isLocked) {
      req.user = user;
      req.token = token;
    }
    
    next();
    
  } catch (error) {
    // Ignorar errores de token en middleware opcional
    next();
  }
};

// Middleware para verificar permisos específicos
const requirePermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'Debes estar autenticado para acceder a este recurso'
      });
    }

    // Definir permisos por rol
    const rolePermissions = {
      user: ['read:own', 'update:own', 'delete:own'],
      moderator: ['read:own', 'update:own', 'delete:own', 'read:all', 'moderate:content'],
      admin: ['*'] // Todos los permisos
    };

    const userPermissions = rolePermissions[req.user.role] || [];
    
    // Admin tiene todos los permisos
    if (userPermissions.includes('*')) {
      return next();
    }

    // Verificar si el usuario tiene los permisos requeridos
    const hasPermission = permissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: 'No tienes los permisos necesarios para realizar esta acción'
      });
    }

    next();
  };
};

// Middleware para verificar verificación de email
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      message: 'Debes estar autenticado para acceder a este recurso'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      error: 'Email no verificado',
      message: 'Debes verificar tu email antes de acceder a este recurso'
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  moderatorMiddleware,
  ownerOrAdminMiddleware,
  optionalAuthMiddleware,
  requirePermissions,
  requireEmailVerification
};