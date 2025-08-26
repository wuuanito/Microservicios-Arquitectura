# Usar imagen oficial de Node.js LTS
FROM node:18-alpine

# Información del mantenedor
LABEL maintainer="auth-service@microservices.com"
LABEL description="Microservicio de autenticación y autorización"
LABEL version="1.0.0"

# Crear directorio de la aplicación
WORKDIR /usr/src/app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar código fuente
COPY . .

# Crear directorio de logs y asignar permisos
RUN mkdir -p logs && \
    chown -R nodejs:nodejs /usr/src/app

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Usar dumb-init para manejar señales correctamente
ENTRYPOINT ["dumb-init", "--"]

# Comando por defecto
CMD ["node", "src/index.js"]