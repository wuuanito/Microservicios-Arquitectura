const Joi = require('joi');
const validator = require('validator');

// Configuración personalizada de Joi
const customJoi = Joi.extend({
  type: 'string',
  base: Joi.string(),
  messages: {
    'string.strongPassword': 'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos',
    'string.validEmail': 'El formato del email no es válido',
    'string.noSpaces': 'No se permiten espacios en este campo',
    'string.alphanumeric': 'Solo se permiten caracteres alfanuméricos'
  },
  rules: {
    strongPassword: {
      validate(value, helpers) {
        // Al menos 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 símbolo
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!strongPasswordRegex.test(value)) {
          return helpers.error('string.strongPassword');
        }
        return value;
      }
    },
    validEmail: {
      validate(value, helpers) {
        if (!validator.isEmail(value)) {
          return helpers.error('string.validEmail');
        }
        return value;
      }
    },
    noSpaces: {
      validate(value, helpers) {
        if (/\s/.test(value)) {
          return helpers.error('string.noSpaces');
        }
        return value;
      }
    },
    alphanumeric: {
      validate(value, helpers) {
        if (!/^[a-zA-Z0-9]+$/.test(value)) {
          return helpers.error('string.alphanumeric');
        }
        return value;
      }
    }
  }
});

// Esquemas de validación para autenticación
const authSchemas = {
  // Registro de usuario
  register: customJoi.object({
    email: customJoi.string()
      .validEmail()
      .lowercase()
      .trim()
      .max(255)
      .required()
      .messages({
        'string.empty': 'El email es requerido',
        'string.max': 'El email no puede exceder 255 caracteres',
        'any.required': 'El email es requerido'
      }),
    
    password: customJoi.string()
      .strongPassword()
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.empty': 'La contraseña es requerida',
        'string.min': 'La contraseña debe tener al menos 8 caracteres',
        'string.max': 'La contraseña no puede exceder 128 caracteres',
        'any.required': 'La contraseña es requerida'
      }),
    
    confirmPassword: customJoi.string()
      .valid(customJoi.ref('password'))
      .required()
      .messages({
        'any.only': 'Las contraseñas no coinciden',
        'any.required': 'La confirmación de contraseña es requerida'
      }),
    
    usuario: customJoi.string()
      .trim()
      .min(3)
      .max(20)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .required()
      .messages({
        'string.empty': 'El usuario es requerido',
        'string.min': 'El usuario debe tener al menos 3 caracteres',
        'string.max': 'El usuario no puede exceder 20 caracteres',
        'string.pattern.base': 'El usuario solo puede contener letras, números y guiones bajos',
        'any.required': 'El usuario es requerido'
      }),
    
    departamento: customJoi.string()
      .valid('administracion', 'compras', 'informatica', 'gerencia', 'rrhh', 'produccion', 'softgel', 'calidad', 'laboratorio', 'mantenimiento', 'oficina_tecnica', 'logistica')
      .required()
      .messages({
        'any.only': 'Departamento no válido',
        'any.required': 'El departamento es requerido'
      }),
    
    rol: customJoi.string()
      .valid('administrador', 'director', 'usuario')
      .required()
      .messages({
        'any.only': 'Rol no válido',
        'any.required': 'El rol es requerido'
      }),
    
    phone: customJoi.string()
      .pattern(/^[+]?[1-9]\d{1,14}$/)
      .optional()
      .messages({
        'string.pattern.base': 'El formato del teléfono no es válido'
      }),
    
    dateOfBirth: customJoi.date()
      .max('now')
      .min('1900-01-01')
      .optional()
      .messages({
        'date.max': 'La fecha de nacimiento no puede ser futura',
        'date.min': 'La fecha de nacimiento no es válida'
      }),
    
    acceptTerms: customJoi.boolean()
      .valid(true)
      .required()
      .messages({
        'any.only': 'Debe aceptar los términos y condiciones',
        'any.required': 'Debe aceptar los términos y condiciones'
      })
  }),
  
  // Login de usuario
  login: customJoi.object({
    email: customJoi.string()
      .validEmail()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'El email es requerido',
        'any.required': 'El email es requerido'
      }),
    
    password: customJoi.string()
      .min(1)
      .required()
      .messages({
        'string.empty': 'La contraseña es requerida',
        'any.required': 'La contraseña es requerida'
      }),
    
    rememberMe: customJoi.boolean()
      .optional()
      .default(false)
  }),
  
  // Cambio de contraseña
  changePassword: customJoi.object({
    currentPassword: customJoi.string()
      .required()
      .messages({
        'string.empty': 'La contraseña actual es requerida',
        'any.required': 'La contraseña actual es requerida'
      }),
    
    newPassword: customJoi.string()
      .strongPassword()
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.empty': 'La nueva contraseña es requerida',
        'string.min': 'La nueva contraseña debe tener al menos 8 caracteres',
        'string.max': 'La nueva contraseña no puede exceder 128 caracteres',
        'any.required': 'La nueva contraseña es requerida'
      }),
    
    confirmNewPassword: customJoi.string()
      .valid(customJoi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Las contraseñas no coinciden',
        'any.required': 'La confirmación de contraseña es requerida'
      })
  }),
  
  // Recuperación de contraseña
  forgotPassword: customJoi.object({
    email: customJoi.string()
      .validEmail()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'El email es requerido',
        'any.required': 'El email es requerido'
      })
  }),
  
  // Reset de contraseña
  resetPassword: customJoi.object({
    token: customJoi.string()
      .required()
      .messages({
        'string.empty': 'El token es requerido',
        'any.required': 'El token es requerido'
      }),
    
    newPassword: customJoi.string()
      .strongPassword()
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.empty': 'La nueva contraseña es requerida',
        'string.min': 'La nueva contraseña debe tener al menos 8 caracteres',
        'string.max': 'La nueva contraseña no puede exceder 128 caracteres',
        'any.required': 'La nueva contraseña es requerida'
      }),
    
    confirmNewPassword: customJoi.string()
      .valid(customJoi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Las contraseñas no coinciden',
        'any.required': 'La confirmación de contraseña es requerida'
      })
  }),
  
  // Verificación de email
  verifyEmail: customJoi.object({
    token: customJoi.string()
      .required()
      .messages({
        'string.empty': 'El token es requerido',
        'any.required': 'El token es requerido'
      })
  }),
  
  // Refresh token
  refreshToken: customJoi.object({
    refreshToken: customJoi.string()
      .required()
      .messages({
        'string.empty': 'El refresh token es requerido',
        'any.required': 'El refresh token es requerido'
      })
  })
};

// Esquemas de validación para perfil de usuario
const userSchemas = {
  // Actualizar perfil
  updateProfile: customJoi.object({
    usuario: customJoi.string()
      .trim()
      .min(3)
      .max(20)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .optional()
      .messages({
        'string.min': 'El usuario debe tener al menos 3 caracteres',
        'string.max': 'El usuario no puede exceder 20 caracteres',
        'string.pattern.base': 'El usuario solo puede contener letras, números y guiones bajos'
      }),
    
    departamento: customJoi.string()
      .valid('administracion', 'compras', 'informatica', 'gerencia', 'rrhh', 'produccion', 'softgel', 'calidad', 'laboratorio', 'mantenimiento', 'oficina_tecnica', 'logistica')
      .optional()
      .messages({
        'any.only': 'Departamento no válido'
      }),
    
    rol: customJoi.string()
      .valid('administrador', 'director', 'usuario')
      .optional()
      .messages({
        'any.only': 'Rol no válido'
      }),
    
    phone: customJoi.string()
      .pattern(/^[+]?[1-9]\d{1,14}$/)
      .optional()
      .allow('')
      .messages({
        'string.pattern.base': 'El formato del teléfono no es válido'
      }),
    
    dateOfBirth: customJoi.date()
      .max('now')
      .min('1900-01-01')
      .optional()
      .messages({
        'date.max': 'La fecha de nacimiento no puede ser futura',
        'date.min': 'La fecha de nacimiento no es válida'
      }),
    
    bio: customJoi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'La biografía no puede exceder 500 caracteres'
      }),
    
    preferences: customJoi.object({
      language: customJoi.string()
        .valid('es', 'en', 'fr', 'pt')
        .optional(),
      
      timezone: customJoi.string()
        .optional(),
      
      notifications: customJoi.object({
        email: customJoi.boolean().optional(),
        push: customJoi.boolean().optional(),
        sms: customJoi.boolean().optional()
      }).optional()
    }).optional()
  }),
  
  // Actualizar rol (solo admin)
  updateRole: customJoi.object({
    role: customJoi.string()
      .valid('user', 'moderator', 'admin')
      .required()
      .messages({
        'any.only': 'El rol debe ser: user, moderator o admin',
        'any.required': 'El rol es requerido'
      })
  }),
  
  // Activar/desactivar usuario (solo admin)
  toggleUserStatus: customJoi.object({
    isActive: customJoi.boolean()
      .required()
      .messages({
        'any.required': 'El estado es requerido'
      })
  })
};

// Esquemas de validación para parámetros de URL
const paramSchemas = {
  // ID de usuario
  userId: customJoi.object({
    id: customJoi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'ID de usuario no válido',
        'any.required': 'ID de usuario requerido'
      })
  }),
  
  // Token
  token: customJoi.object({
    token: customJoi.string()
      .required()
      .messages({
        'string.empty': 'Token requerido',
        'any.required': 'Token requerido'
      })
  })
};

// Esquemas de validación para query parameters
const querySchemas = {
  // Paginación
  pagination: customJoi.object({
    page: customJoi.number()
      .integer()
      .min(1)
      .default(1)
      .optional(),
    
    limit: customJoi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .optional(),
    
    sort: customJoi.string()
      .valid('createdAt', '-createdAt', 'email', '-email', 'usuario', '-usuario')
      .default('-createdAt')
      .optional(),
    
    search: customJoi.string()
      .max(100)
      .optional()
      .allow(''),
    
    role: customJoi.string()
      .valid('user', 'moderator', 'admin')
      .optional(),
    
    isActive: customJoi.boolean()
      .optional(),
    
    isEmailVerified: customJoi.boolean()
      .optional()
  })
};

// Middleware de validación
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors
      });
    }
    
    // Reemplazar los datos originales con los validados y sanitizados
    req[property] = value;
    next();
  };
};

// Validadores específicos
const validateRegister = validate(authSchemas.register);
const validateLogin = validate(authSchemas.login);
const validateChangePassword = validate(authSchemas.changePassword);
const validateForgotPassword = validate(authSchemas.forgotPassword);
const validateResetPassword = validate(authSchemas.resetPassword);
const validateVerifyEmail = validate(authSchemas.verifyEmail);
const validateRefreshToken = validate(authSchemas.refreshToken);
const validateUpdateProfile = validate(userSchemas.updateProfile);
const validateUpdateRole = validate(userSchemas.updateRole);
const validateToggleUserStatus = validate(userSchemas.toggleUserStatus);
const validateUserId = validate(paramSchemas.userId, 'params');
const validateToken = validate(paramSchemas.token, 'params');
const validatePagination = validate(querySchemas.pagination, 'query');

// Función para validar datos manualmente
const validateData = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return { isValid: false, errors, data: null };
  }
  
  return { isValid: true, errors: null, data: value };
};

// Función para sanitizar entrada
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return validator.escape(input.trim());
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

// Función para validar email específicamente
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Función para validar contraseña fuerte
const isStrongPassword = (password) => {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
};

// Función para validar ObjectId de MongoDB
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

module.exports = {
  // Esquemas
  authSchemas,
  userSchemas,
  paramSchemas,
  querySchemas,
  
  // Middlewares de validación
  validate,
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateVerifyEmail,
  validateRefreshToken,
  validateUpdateProfile,
  validateUpdateRole,
  validateToggleUserStatus,
  validateUserId,
  validateToken,
  validatePagination,
  
  // Funciones de utilidad
  validateData,
  sanitizeInput,
  isValidEmail,
  isStrongPassword,
  isValidObjectId
};