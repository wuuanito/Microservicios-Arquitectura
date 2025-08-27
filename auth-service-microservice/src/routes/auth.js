const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { createError } = require('../utils/errors');

const router = express.Router();

// Rate limiting específico para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por IP
  message: {
    error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false
  }
});

// Validaciones
const registerValidation = [
  body('usuario')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('El usuario debe tener entre 3 y 20 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El usuario solo puede contener letras, números y guiones bajos'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  body('departamento')
    .isIn(['administracion', 'compras', 'informatica', 'gerencia', 'rrhh', 'produccion', 'softgel', 'calidad', 'laboratorio', 'mantenimiento', 'oficina_tecnica', 'logistica'])
    .withMessage('Departamento no válido'),
  body('rol')
    .isIn(['administrador', 'director', 'usuario'])
    .withMessage('Rol no válido')
];

const loginValidation = [
  body('usuario')
    .trim()
    .notEmpty()
    .withMessage('El usuario es requerido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
];

// Helper para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      details: errors.array()
    });
  }
  next();
};

// POST /api/auth/register
router.post('/register', registerValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { usuario, password, email, departamento, rol } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ $or: [{ usuario }, { email }] });
    if (existingUser) {
      return res.status(409).json({
        error: 'El usuario ya existe',
        message: 'Ya existe una cuenta con este usuario o email'
      });
    }

    // Crear nuevo usuario
    const user = new User({
      usuario,
      password,
      email,
      departamento,
      rol
    });

    await user.save();

    // Crear sesión
    req.session.userId = user._id;
    req.session.usuario = user.usuario;
    req.session.rol = user.rol;
    req.session.departamento = user.departamento;

    // Generar tokens (mantener compatibilidad)
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    await user.save(); // Guardar refresh token

    // Configurar cookie con refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    logger.info(`Usuario registrado: ${usuario}`, {
      userId: user._id,
      ip: req.ip
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: user.toJSON(),
      accessToken,
      session: {
        userId: req.session.userId,
        usuario: req.session.usuario,
        rol: req.session.rol,
        departamento: req.session.departamento
      }
    });

  } catch (error) {
    logger.error('Error en registro:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, loginValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { usuario, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ usuario, isActive: true });
    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar si la cuenta está bloqueada
    if (user.isLocked) {
      return res.status(423).json({
        error: 'Cuenta bloqueada',
        message: 'Cuenta temporalmente bloqueada por múltiples intentos fallidos'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Login exitoso - resetear intentos
    await user.resetLoginAttempts();
    
    // Limpiar refresh tokens expirados
    user.cleanExpiredRefreshTokens();

    // Crear sesión
    req.session.userId = user._id;
    req.session.usuario = user.usuario;
    req.session.rol = user.rol;
    req.session.departamento = user.departamento;

    // Generar nuevos tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    await user.save();

    // Configurar cookie con refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    logger.info(`Usuario logueado: ${usuario}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Login exitoso',
      user: user.toJSON(),
      accessToken,
      session: {
        userId: req.session.userId,
        usuario: req.session.usuario,
        rol: req.session.rol,
        departamento: req.session.departamento
      }
    });

  } catch (error) {
    logger.error('Error en login:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Token de actualización requerido',
        message: 'No se encontró token de actualización'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret');
    
    // Buscar usuario y verificar que el token existe
    const user = await User.findOne({
      _id: decoded.userId,
      'refreshTokens.token': refreshToken,
      isActive: true
    });

    if (!user) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Token de actualización inválido o expirado'
      });
    }

    // Generar nuevo access token
    const newAccessToken = user.generateAuthToken();

    res.json({
      message: 'Token actualizado exitosamente',
      accessToken: newAccessToken
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Token de actualización inválido o expirado'
      });
    }
    
    logger.error('Error en refresh token:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    const user = req.user;

    // Revocar refresh token si existe
    if (refreshToken) {
      user.revokeRefreshToken(refreshToken);
      await user.save();
    }

    // Destruir sesión
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error al destruir sesión:', err);
      }
    });

    // Limpiar cookie
    res.clearCookie('refreshToken');

    logger.info(`Usuario deslogueado: ${user.usuario}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Logout exitoso'
    });

  } catch (error) {
    logger.error('Error en logout:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// POST /api/auth/logout-all
router.post('/logout-all', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;

    // Revocar todos los refresh tokens
    user.refreshTokens = [];
    await user.save();

    // Destruir sesión
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error al destruir sesión:', err);
      }
    });

    // Limpiar cookie
    res.clearCookie('refreshToken');

    logger.info(`Usuario deslogueado de todos los dispositivos: ${user.usuario}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Deslogueado de todos los dispositivos exitosamente'
    });

  } catch (error) {
    logger.error('Error en logout-all:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    user: req.user.toJSON()
  });
});

// GET /api/auth/verify-token
router.get('/verify-token', authMiddleware, async (req, res) => {
  res.json({
    valid: true,
    user: req.user.toJSON()
  });
});

module.exports = router;