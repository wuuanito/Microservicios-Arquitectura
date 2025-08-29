// Configuración de rutas para microservicios
module.exports = {
  routes: [
    {
      path: '/api/auth/v1',
      target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
      description: 'Servicio de autenticación y autorización',
      changeOrigin: true,
      pathRewrite: {
        '^/api/auth/v1': '/api/auth' // Reemplaza el prefijo con la ruta del auth-service
      },
      timeout: 60000,
      retries: 3
      // healthCheck: '/health' // Disabled temporarily
    },
    {
      path: '/api/users/v1',
      target: process.env.USER_SERVICE_URL || 'http://user-service:3002',
      description: 'Servicio de gestión de usuarios',
      changeOrigin: true,
      pathRewrite: {
        '^/api/users/v1': ''
      },
      timeout: 60000,
      retries: 3
      // healthCheck: '/health' // Disabled temporarily
    },
    {
      path: '/api/products/v1',
      target: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003',
      description: 'Servicio de gestión de productos',
      changeOrigin: true,
      pathRewrite: {
        '^/api/products/v1': ''
      },
      timeout: 60000,
      retries: 3
      // healthCheck: '/health' // Disabled temporarily
    },
    {
      path: '/api/orders/v1',
      target: process.env.ORDER_SERVICE_URL || 'http://order-service:3004',
      description: 'Servicio de gestión de pedidos',
      changeOrigin: true,
      pathRewrite: {
        '^/api/orders/v1': ''
      },
      timeout: 60000,
      retries: 3
      // healthCheck: '/health' // Disabled temporarily
    },
    {
      path: '/api/notifications/v1',
      target: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005',
      description: 'Servicio de notificaciones',
      changeOrigin: true,
      pathRewrite: {
        '^/api/notifications/v1': ''
      },
      timeout: 60000,
      retries: 3
      // healthCheck: '/health' // Disabled temporarily
    },
    {
      path: '/api/websocket/v1',
      target: process.env.WEBSOCKET_SERVICE_URL || 'http://192.168.11.7:6003',
      description: 'Servicio de WebSocket y notificaciones en tiempo real',
      changeOrigin: true,
      pathRewrite: {
        '^/api/websocket/v1': ''
      },
      timeout: 60000,
      retries: 3,
      ws: true // Habilitar soporte para WebSockets
      // healthCheck: '/health' // Disabled temporarily
    },
    {
      path: '/socket.io',
      target: process.env.WEBSOCKET_SERVICE_URL || 'http://192.168.11.7:6003',
      description: 'Socket.IO directo para conexiones WebSocket',
      changeOrigin: true,
      timeout: 60000,
      retries: 3,
      ws: true // Habilitar soporte para WebSockets
    }
  ],
  
  // Configuración global para todos los proxies
  globalConfig: {
    secure: false, // Para desarrollo, cambiar a true en producción
    followRedirects: true,
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Headers que se agregan a todas las peticiones
    headers: {
      'X-Forwarded-Proto': 'http',
      'X-API-Gateway': 'true'
    },
    
    // Configuración de circuit breaker
    circuitBreaker: {
      enabled: true,
      threshold: 5, // Número de fallos antes de abrir el circuito
      timeout: 60000, // Tiempo en ms antes de intentar cerrar el circuito
      resetTimeout: 30000 // Tiempo en ms para resetear el contador de fallos
    }
  }
};

// Función para obtener configuración de ruta por path
module.exports.getRouteConfig = function(path) {
  return this.routes.find(route => path.startsWith(route.path));
};

// Función para validar configuración
module.exports.validateConfig = function() {
  const errors = [];
  
  this.routes.forEach((route, index) => {
    if (!route.path) {
      errors.push(`Ruta ${index}: 'path' es requerido`);
    }
    if (!route.target) {
      errors.push(`Ruta ${index}: 'target' es requerido`);
    }
    if (route.timeout && route.timeout < 1000) {
      errors.push(`Ruta ${index}: 'timeout' debe ser al menos 1000ms`);
    }
  });
  
  return errors;
};