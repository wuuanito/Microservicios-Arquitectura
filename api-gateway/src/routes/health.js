const express = require('express');
const axios = require('axios');
const router = express.Router();
const routeConfig = require('../config/routes');
const logger = require('../utils/logger');

// Health check básico del API Gateway
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      gateway: {
        status: 'up',
        responseTime: 0,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
        },
        cpu: process.cpuUsage()
      },
      services: []
    };

    // Verificar salud de microservicios si se solicita
    if (req.query.checkServices === 'true') {
      const serviceChecks = await Promise.allSettled(
        routeConfig.routes.map(route => checkServiceHealth(route))
      );

      healthStatus.services = serviceChecks.map((result, index) => {
        const route = routeConfig.routes[index];
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            name: route.description || route.path,
            url: route.target,
            status: 'down',
            error: result.reason.message,
            responseTime: null
          };
        }
      });

      // Determinar estado general basado en servicios
      const downServices = healthStatus.services.filter(s => s.status === 'down');
      if (downServices.length > 0) {
        healthStatus.status = downServices.length === healthStatus.services.length ? 'unhealthy' : 'degraded';
      }
    }

    healthStatus.gateway.responseTime = Date.now() - startTime;

    // Determinar código de respuesta HTTP
    let statusCode = 200;
    if (healthStatus.status === 'unhealthy') {
      statusCode = 503;
    } else if (healthStatus.status === 'degraded') {
      statusCode = 207; // Multi-Status
    }

    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Error en health check', { error: error.message, stack: error.stack });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Error interno en health check',
      gateway: {
        status: 'error',
        responseTime: Date.now() - startTime
      }
    });
  }
});

// Health check detallado
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: process.uptime(),
        human: formatUptime(process.uptime())
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      gateway: {
        status: 'up',
        responseTime: 0,
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        cpu: process.cpuUsage(),
        loadAverage: require('os').loadavg()
      },
      services: [],
      configuration: {
        totalRoutes: routeConfig.routes.length,
        routes: routeConfig.routes.map(route => ({
          path: route.path,
          target: route.target,
          description: route.description
        }))
      }
    };

    // Verificar todos los servicios
    const serviceChecks = await Promise.allSettled(
      routeConfig.routes.map(route => checkServiceHealthDetailed(route))
    );

    detailedHealth.services = serviceChecks.map((result, index) => {
      const route = routeConfig.routes[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: route.description || route.path,
          url: route.target,
          path: route.path,
          status: 'down',
          error: result.reason.message,
          responseTime: null,
          lastChecked: new Date().toISOString()
        };
      }
    });

    // Calcular estadísticas de servicios
    const serviceStats = {
      total: detailedHealth.services.length,
      up: detailedHealth.services.filter(s => s.status === 'up').length,
      down: detailedHealth.services.filter(s => s.status === 'down').length,
      degraded: detailedHealth.services.filter(s => s.status === 'degraded').length
    };

    detailedHealth.serviceStats = serviceStats;

    // Determinar estado general
    if (serviceStats.down === serviceStats.total) {
      detailedHealth.status = 'unhealthy';
    } else if (serviceStats.down > 0 || serviceStats.degraded > 0) {
      detailedHealth.status = 'degraded';
    }

    detailedHealth.gateway.responseTime = Date.now() - startTime;

    let statusCode = 200;
    if (detailedHealth.status === 'unhealthy') {
      statusCode = 503;
    } else if (detailedHealth.status === 'degraded') {
      statusCode = 207;
    }

    res.status(statusCode).json(detailedHealth);
    
  } catch (error) {
    logger.error('Error en health check detallado', { error: error.message, stack: error.stack });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Error interno en health check detallado',
      gateway: {
        status: 'error',
        responseTime: Date.now() - startTime
      }
    });
  }
});

// Health check de un servicio específico
router.get('/service/:serviceName', async (req, res) => {
  const serviceName = req.params.serviceName;
  const route = routeConfig.routes.find(r => 
    r.path.includes(serviceName) || r.description?.toLowerCase().includes(serviceName.toLowerCase())
  );

  if (!route) {
    return res.status(404).json({
      error: 'Servicio no encontrado',
      serviceName,
      availableServices: routeConfig.routes.map(r => r.description || r.path)
    });
  }

  try {
    const serviceHealth = await checkServiceHealthDetailed(route);
    res.json(serviceHealth);
  } catch (error) {
    res.status(503).json({
      name: route.description || route.path,
      url: route.target,
      status: 'down',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Función para verificar salud básica de un servicio
async function checkServiceHealth(route) {
  const startTime = Date.now();
  const healthUrl = `${route.target}${route.healthCheck || '/health'}`;
  
  try {
    const response = await axios.get(healthUrl, {
      timeout: 5000,
      validateStatus: (status) => status < 500
    });
    
    return {
      name: route.description || route.path,
      url: route.target,
      status: response.status < 400 ? 'up' : 'degraded',
      responseTime: Date.now() - startTime,
      statusCode: response.status
    };
  } catch (error) {
    throw new Error(`Health check failed: ${error.message}`);
  }
}

// Función para verificar salud detallada de un servicio
async function checkServiceHealthDetailed(route) {
  const startTime = Date.now();
  const healthUrl = `${route.target}${route.healthCheck || '/health'}`;
  
  try {
    const response = await axios.get(healthUrl, {
      timeout: 10000,
      validateStatus: (status) => status < 500
    });
    
    return {
      name: route.description || route.path,
      url: route.target,
      path: route.path,
      status: response.status < 400 ? 'up' : 'degraded',
      responseTime: Date.now() - startTime,
      statusCode: response.status,
      lastChecked: new Date().toISOString(),
      details: response.data || null
    };
  } catch (error) {
    throw new Error(`Health check failed: ${error.message}`);
  }
}

// Función para formatear uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

module.exports = router;