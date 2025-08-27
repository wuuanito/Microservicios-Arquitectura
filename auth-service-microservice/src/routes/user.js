const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

const router = express.Router();

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

// Validaciones
const updateProfileValidation = [
  body('usuario')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('El usuario debe tener entre 3 y 20 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El usuario solo puede contener letras, números y guiones bajos'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe ser un email válido'),
  body('departamento')
    .optional()
    .isIn(['administracion', 'compras', 'informatica', 'gerencia', 'rrhh', 'produccion', 'softgel', 'calidad', 'laboratorio', 'mantenimiento', 'oficina_tecnica', 'logistica'])
    .withMessage('Departamento no válido'),
  body('rol')
    .optional()
    .isIn(['administrador', 'director', 'usuario'])
    .withMessage('Rol no válido')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La nueva contraseña debe contener al menos una mayúscula, una minúscula y un número')
];

// GET /api/users/profile - Obtener perfil del usuario autenticado
router.get('/profile', authMiddleware, async (req, res) => {
  res.json({
    user: req.user.toJSON()
  });
});

// PUT /api/users/profile - Actualizar perfil del usuario autenticado
router.put('/profile', authMiddleware, updateProfileValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { usuario, email, departamento, rol } = req.body;
    const user = req.user;

    // Si se está cambiando el usuario, verificar que no exista
    if (usuario && usuario !== user.usuario) {
      const existingUser = await User.findOne({ usuario, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(409).json({
          error: 'Usuario ya existe',
          message: 'Ya existe una cuenta con este usuario'
        });
      }
      user.usuario = usuario;
    }

    // Si se está cambiando el email, verificar que no exista
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(409).json({
          error: 'Email ya existe',
          message: 'Ya existe una cuenta con este email'
        });
      }
      user.email = email;
      user.isEmailVerified = false; // Requerir verificación del nuevo email
    }

    // Actualizar campos si se proporcionan
    if (departamento) user.departamento = departamento;
    if (rol) user.rol = rol;

    await user.save();

    logger.info(`Perfil actualizado: ${user.email}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: user.toJSON()
    });

  } catch (error) {
    logger.error('Error actualizando perfil:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// PUT /api/users/change-password - Cambiar contraseña
router.put('/change-password', authMiddleware, changePasswordValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Contraseña incorrecta',
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        error: 'Contraseña inválida',
        message: 'La nueva contraseña debe ser diferente a la actual'
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    
    // Revocar todos los refresh tokens por seguridad
    user.refreshTokens = [];
    
    await user.save();

    logger.info(`Contraseña cambiada: ${user.email}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente.'
    });

  } catch (error) {
    logger.error('Error cambiando contraseña:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// DELETE /api/users/account - Eliminar cuenta del usuario autenticado
router.delete('/account', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;

    // Marcar como inactivo en lugar de eliminar (soft delete)
    user.isActive = false;
    user.refreshTokens = [];
    await user.save();

    logger.info(`Cuenta eliminada: ${user.email}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Cuenta eliminada exitosamente'
    });

  } catch (error) {
    logger.error('Error eliminando cuenta:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// === RUTAS DE ADMINISTRADOR ===

// GET /api/users - Listar usuarios (solo admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    // Filtros opcionales
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { email: { $regex: req.query.search, $options: 'i' } },
        { usuario: { $regex: req.query.search, $options: 'i' } },
        { departamento: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error listando usuarios:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// GET /api/users/:id - Obtener usuario por ID (solo admin)
router.get('/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshTokens');
    
    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    res.json({ user });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'ID de usuario inválido'
      });
    }
    
    logger.error('Error obteniendo usuario:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// PUT /api/users/:id/role - Actualizar rol de usuario (solo admin)
router.put('/:id/role', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({
        error: 'Rol inválido',
        message: 'El rol debe ser: user, admin o moderator'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // No permitir que un admin se quite sus propios permisos
    if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
      return res.status(400).json({
        error: 'Acción no permitida',
        message: 'No puedes cambiar tu propio rol de administrador'
      });
    }

    user.role = role;
    await user.save();

    logger.info(`Rol actualizado: ${user.email} -> ${role}`, {
      adminId: req.user._id,
      targetUserId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Rol actualizado exitosamente',
      user: user.toJSON()
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'ID de usuario inválido'
      });
    }
    
    logger.error('Error actualizando rol:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

// PUT /api/users/:id/status - Activar/desactivar usuario (solo admin)
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: 'Estado inválido',
        message: 'isActive debe ser true o false'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // No permitir que un admin se desactive a sí mismo
    if (user._id.toString() === req.user._id.toString() && !isActive) {
      return res.status(400).json({
        error: 'Acción no permitida',
        message: 'No puedes desactivar tu propia cuenta'
      });
    }

    user.isActive = isActive;
    
    // Si se desactiva, revocar todos los refresh tokens
    if (!isActive) {
      user.refreshTokens = [];
    }
    
    await user.save();

    logger.info(`Estado de usuario actualizado: ${user.email} -> ${isActive ? 'activo' : 'inactivo'}`, {
      adminId: req.user._id,
      targetUserId: user._id,
      ip: req.ip
    });

    res.json({
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      user: user.toJSON()
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'ID de usuario inválido'
      });
    }
    
    logger.error('Error actualizando estado:', error);
    next(createError(500, 'Error interno del servidor'));
  }
});

module.exports = router;