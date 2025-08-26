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
});

// Validaciones
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe ser un email válido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe ser un email válido'),
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
    const { email, password, firstName, lastName } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        error: 'El usuario ya existe',
        message: 'Ya existe una cuenta con este email'
      });
    }

    // Crear nuevo usuario
    const user = new User({
      email,
      password,
      firstName,
      lastName
    });

    await user.save();

    // Generar tokens
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

    logger.info(`Usuario registrado: ${email}`, {
      userId: user._id,
      ip: req.ip
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: user.toJSON(),
      accessToken
    });

  } catch (error) {
    logger.error('Error en registro:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, loginValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
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
        message: 'Email o contraseña incorrectos'
      });
    }

    // Login exitoso - resetear intentos
    await user.resetLoginAttempts();
    
    // Limpiar refresh tokens expirados
    user.cleanExpiredRefreshTokens();

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

    logger.info(`Usuario logueado: ${email}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Login exitoso',
      user: user.toJSON(),
      accessToken
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

    // Limpiar cookie
    res.clearCookie('refreshToken');

    logger.info(`Usuario deslogueado: ${user.email}`, {
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

    // Limpiar cookie
    res.clearCookie('refreshToken');

    logger.info(`Usuario deslogueado de todos los dispositivos: ${user.email}`, {
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