# Usar imagen base oficial de Node.js LTS
FROM node:18-alpine AS base

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S apigateway -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Crear directorio para logs
RUN mkdir -p /app/logs && chown -R apigateway:nodejs /app/logs

# Copiar código fuente
COPY --chown=apigateway:nodejs . .

# Cambiar a usuario no-root
USER apigateway

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Comando de inicio con dumb-init
CMD ["dumb-init", "node", "src/index.js"]