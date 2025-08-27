# Arquitectura de Microservicios

Este proyecto implementa una arquitectura de microservicios moderna utilizando Node.js, Express, MongoDB y Docker. La aplicación está diseñada para ser escalable, mantenible y fácil de desarrollar.

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Auth Service  │
│   (Puerto 8080) │◄──►│   (Puerto 3000) │◄──►│   (Puerto 3001) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │    MongoDB      │    │     Logs        │
                       │  (Puerto 27017) │    │   Centralizados │
                       └─────────────────┘    └─────────────────┘
```

## 📁 Estructura del Proyecto

```
Microservicios-Arquitectura/
├── api-gateway/                 # Gateway principal - Puerto 3000
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
├── auth-service/                # Servicio de autenticación - Puerto 3001
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
├── docker-compose.yml           # Orquestación de todos los servicios
└── README.md                    # Este archivo
```

## 🚀 Servicios Disponibles

### 1. API Gateway (Puerto 3000)
- **Función**: Punto de entrada único para todas las peticiones
- **Responsabilidades**:
  - Enrutamiento de peticiones a microservicios
  - Autenticación y autorización
  - Rate limiting
  - Logging centralizado
  - Manejo de CORS
  - Load balancing

### 2. Auth Service (Puerto 3001)
- **Función**: Gestión de autenticación y autorización
- **Responsabilidades**:
  - Registro de usuarios
  - Login/Logout
  - Gestión de tokens JWT
  - Refresh tokens
  - Verificación de email
  - Recuperación de contraseñas
  - Gestión de roles y permisos
  - Auditoría de seguridad

### 3. MongoDB (Puerto 27017)
- **Función**: Base de datos principal
- **Características**:
  - Almacenamiento de datos de usuarios
  - Colecciones separadas por servicio
  - Índices optimizados
  - Replicación (en producción)

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js + Express.js
- **Base de Datos**: MongoDB + Mongoose
- **Autenticación**: JWT (JSON Web Tokens)
- **Contenedores**: Docker + Docker Compose
- **Logging**: Winston
- **Validación**: Joi
- **Seguridad**: Helmet, bcryptjs, rate limiting
- **Monitoreo**: Health checks integrados

## 🚦 Inicio Rápido

### Prerrequisitos
- Docker y Docker Compose instalados
- Node.js 18+ (para desarrollo local)
- Git

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd Microservicios-Arquitectura
```

### 2. Configurar variables de entorno
Crea archivos `.env` en cada servicio o modifica las variables en `docker-compose.yml`:

```bash
# Ejemplo de variables importantes
JWT_SECRET=tu-clave-secreta-muy-segura
JWT_REFRESH_SECRET=tu-clave-refresh-muy-segura
MONGODB_URI=mongodb://mongo:27017/auth
NODE_ENV=development
# Pipeline actualizado para compatibilidad cross-platform
```

### 3. Ejecutar con Docker Compose
```bash
# Construir y ejecutar todos los servicios
docker-compose up --build

# Ejecutar en segundo plano
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar servicios
docker-compose down
```

### 4. Verificar servicios
- **API Gateway**: http://localhost:3000/health
- **Auth Service**: http://localhost:3001/health
- **MongoDB**: mongodb://localhost:27017

## 📋 Endpoints Principales

### API Gateway (http://localhost:3000)
```
GET  /health              # Health check
POST /api/auth/*          # Proxy a auth-service
GET  /api/users/*         # Proxy a user-service (futuro)
GET  /api/products/*      # Proxy a product-service (futuro)
```

### Auth Service (http://localhost:3001)
```
# Autenticación
POST /auth/register       # Registro de usuario
POST /auth/login          # Login
POST /auth/logout         # Logout
POST /auth/refresh        # Renovar token

# Gestión de contraseñas
POST /auth/forgot-password    # Solicitar reset
POST /auth/reset-password     # Reset con token
POST /auth/change-password    # Cambiar contraseña

# Verificación
POST /auth/verify-email       # Verificar email
POST /auth/resend-verification # Reenviar verificación

# Perfil de usuario
GET  /users/profile           # Obtener perfil
PUT  /users/profile           # Actualizar perfil
DEL  /users/account           # Eliminar cuenta

# Administración (solo admin)
GET  /users                   # Listar usuarios
GET  /users/:id               # Obtener usuario
PUT  /users/:id/role          # Cambiar rol
PUT  /users/:id/status        # Activar/desactivar

# Utilidades
GET  /health                  # Health check
```

## 🔒 Seguridad

### Características implementadas:
- **Autenticación JWT** con refresh tokens
- **Hashing de contraseñas** con bcrypt (12 rounds)
- **Rate limiting** configurable por endpoint
- **Validación de entrada** con Joi
- **Sanitización** de datos
- **Headers de seguridad** con Helmet
- **CORS** configurado
- **Logging de seguridad** para auditoría
- **Detección de actividad sospechosa**

### Variables de seguridad importantes:
```bash
JWT_SECRET=clave-muy-segura-de-al-menos-32-caracteres
JWT_REFRESH_SECRET=otra-clave-muy-segura-diferente
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000  # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100  # Máximo por ventana
```

## 📊 Monitoreo y Logs

### Logs centralizados:
- **combined.log**: Todos los logs
- **error.log**: Solo errores
- **auth.log**: Eventos de autenticación
- **security.log**: Eventos de seguridad
- **performance.log**: Métricas de rendimiento
- **http.log**: Requests HTTP

### Health checks:
Todos los servicios incluyen endpoints `/health` que verifican:
- Estado del servicio
- Conectividad a MongoDB
- Uso de memoria
- Tiempo de respuesta

## 🔧 Desarrollo

### Ejecutar servicios individualmente:
```bash
# Auth Service
cd auth-service
npm install
npm run dev

# API Gateway
cd api-gateway
npm install
npm run dev
```

### Scripts útiles:
```bash
# Instalar dependencias en todos los servicios
find . -name "package.json" -not -path "./node_modules/*" -execdir npm install \;

# Limpiar contenedores y volúmenes
docker-compose down -v
docker system prune -f

# Reconstruir servicios específicos
docker-compose up --build auth-service
```

## 🚀 Próximos Microservicios

La arquitectura está preparada para agregar:

1. **User Service** (Puerto 3002)
   - Gestión de perfiles de usuario
   - Preferencias y configuraciones
   - Historial de actividad

2. **Product Service** (Puerto 3003)
   - Catálogo de productos
   - Inventario
   - Categorías y filtros

3. **Order Service** (Puerto 3004)
   - Gestión de pedidos
   - Carrito de compras
   - Historial de compras

4. **Notification Service** (Puerto 3005)
   - Emails transaccionales
   - Notificaciones push
   - SMS

## 📈 Escalabilidad

### Características para producción:
- **Load balancing** con múltiples instancias
- **Base de datos replicada** con MongoDB Replica Set
- **Cache distribuido** con Redis
- **Message queues** con RabbitMQ o Apache Kafka
- **Monitoreo** con Prometheus + Grafana
- **Logging centralizado** con ELK Stack
- **CI/CD** con GitHub Actions o Jenkins

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 Soporte

Para soporte técnico o preguntas:
- Crear un issue en GitHub
- Contactar al equipo de desarrollo
- Revisar la documentación en `/docs`

---

**Nota**: Este proyecto está en desarrollo activo. Las funcionalidades y la documentación pueden cambiar frecuentemente.