# API Gateway para Microservicios

API Gateway robusto y escalable diseñado para manejar el enrutamiento, autenticación y monitoreo de una arquitectura de microservicios.

## 🚀 Características

- **Enrutamiento Dinámico**: Configuración flexible de rutas para múltiples microservicios
- **Autenticación JWT**: Validación de tokens con fallback y cache
- **Circuit Breaker**: Protección contra fallos en cascada
- **Rate Limiting**: Control de tráfico por IP
- **Health Checks**: Monitoreo de salud de microservicios
- **Logging Estructurado**: Sistema de logs completo con rotación
- **Retry Logic**: Reintentos automáticos con backoff exponencial
- **Containerización**: Listo para Docker y Kubernetes
- **Monitoreo**: Integración con Prometheus y Grafana

## 📋 Requisitos

- Node.js >= 16.0.0
- Docker y Docker Compose (para containerización)
- MongoDB (para microservicios)

## 🛠️ Instalación

### Desarrollo Local

```bash
# Clonar el repositorio
git clone <repository-url>
cd api-gateway

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar configuración
nano .env

# Iniciar en modo desarrollo
npm run dev
```

### Con Docker

```bash
# Construir imagen
docker build -t api-gateway .

# Ejecutar contenedor
docker run -p 3000:3000 --env-file .env api-gateway
```

### Con Docker Compose (Recomendado)

```bash
# Iniciar toda la infraestructura
docker-compose up -d

# Ver logs
docker-compose logs -f api-gateway

# Detener servicios
docker-compose down
```

## ⚙️ Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura las siguientes variables:

```env
# Configuración básica
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# URLs de microservicios
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
PRODUCT_SERVICE_URL=http://product-service:3003
ORDER_SERVICE_URL=http://order-service:3004
NOTIFICATION_SERVICE_URL=http://notification-service:3005

# JWT
JWT_SECRET=your-super-secret-jwt-key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### Configuración de Rutas

Edita `src/config/routes.js` para agregar o modificar microservicios:

```javascript
{
  path: '/api/nuevo-servicio/v1',
  target: 'http://nuevo-servicio:3006',
  description: 'Nuevo microservicio',
  changeOrigin: true,
  pathRewrite: {
    '^/api/nuevo-servicio/v1': ''
  },
  timeout: 30000,
  retries: 3,
  healthCheck: '/health'
}
```

## 🔗 Endpoints

### API Gateway

- `GET /` - Información del gateway y servicios disponibles
- `GET /health` - Health check básico
- `GET /health/detailed` - Health check detallado con estado de servicios
- `GET /health/service/:serviceName` - Health check de servicio específico

### Rutas de Microservicios

- `POST /api/auth/v1/*` → Servicio de Autenticación
- `GET|POST|PUT|DELETE /api/users/v1/*` → Servicio de Usuarios
- `GET|POST|PUT|DELETE /api/products/v1/*` → Servicio de Productos
- `GET|POST|PUT|DELETE /api/orders/v1/*` → Servicio de Pedidos
- `GET|POST|PUT|DELETE /api/notifications/v1/*` → Servicio de Notificaciones

## 🔐 Autenticación

### Uso de JWT

```bash
# Incluir token en headers
Authorization: Bearer <jwt-token>
```

### Middleware de Autenticación

```javascript
// Requerir autenticación
app.use('/api/protected', authenticateToken());

// Autenticación opcional
app.use('/api/public', optionalAuth());

// Requerir roles específicos
app.use('/api/admin', requireRole('admin'));

// Requerir permisos específicos
app.use('/api/users', requirePermission('users:read'));
```

## 📊 Monitoreo

### Health Checks

```bash
# Health check básico
curl http://localhost:3000/health

# Health check con servicios
curl http://localhost:3000/health?checkServices=true

# Health check detallado
curl http://localhost:3000/health/detailed
```

### Logs

Los logs se almacenan en:
- Consola (desarrollo)
- `logs/YYYY-MM-DD.log` (producción)
- `logs/error-YYYY-MM-DD.log` (solo errores)

### Métricas

Si Prometheus está habilitado:
- Métricas disponibles en `http://localhost:9090`
- Dashboard Grafana en `http://localhost:3001`

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar con nodemon
npm start           # Iniciar en producción
npm test            # Ejecutar tests
npm run lint        # Linter

# Docker
npm run docker:build   # Construir imagen
npm run docker:run     # Ejecutar contenedor
```

## 🏗️ Arquitectura

```
┌─────────────────┐
│   Load Balancer │
│     (Nginx)     │
└─────────┬───────┘
          │
┌─────────▼───────┐
│   API Gateway   │
│   (Port 3000)   │
└─────────┬───────┘
          │
    ┌─────┴─────┐
    │           │
┌───▼───┐   ┌───▼───┐
│Auth   │   │Users  │
│Service│   │Service│
│:3001  │   │:3002  │
└───────┘   └───────┘
    │           │
┌───▼───────────▼───┐
│    MongoDB        │
│   (Port 27017)    │
└───────────────────┘
```

## 🚦 Circuit Breaker

El API Gateway incluye un circuit breaker que:
- Abre el circuito después de 5 fallos consecutivos
- Mantiene el circuito abierto por 60 segundos
- Intenta cerrar el circuito gradualmente

## 🔄 Retry Logic

- Reintentos automáticos: 3 intentos por defecto
- Backoff exponencial: 1s, 2s, 4s
- Solo para errores 5xx, timeouts y errores de red

## 📈 Rate Limiting

- 1000 requests por IP cada 15 minutos
- Configurable via variables de entorno
- Headers informativos en respuestas

## 🔒 Seguridad

- Helmet.js para headers de seguridad
- CORS configurable
- Validación de JWT
- Rate limiting
- Logs de seguridad
- Usuario no-root en Docker

## 🐛 Troubleshooting

### Problemas Comunes

1. **Servicio no responde**
   ```bash
   # Verificar health check
   curl http://localhost:3000/health/detailed
   ```

2. **Error de autenticación**
   ```bash
   # Verificar token JWT
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/users/v1/profile
   ```

3. **Logs de errores**
   ```bash
   # Ver logs en tiempo real
   tail -f logs/error-$(date +%Y-%m-%d).log
   ```

### Variables de Debug

```env
LOG_LEVEL=debug
NODE_ENV=development
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver archivo `LICENSE` para detalles.

## 📞 Soporte

Para soporte técnico:
- Crear issue en GitHub
- Revisar logs en `logs/`
- Verificar health checks

---

**Nota**: Este API Gateway está diseñado para ser altamente escalable y robusto. Para producción, asegúrate de:
- Cambiar todas las claves secretas
- Configurar HTTPS
- Implementar monitoreo completo
- Configurar backups de logs
- Revisar configuraciones de seguridad