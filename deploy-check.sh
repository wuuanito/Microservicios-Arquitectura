#!/bin/bash

# Script para verificar el estado del despliegue
echo "=== Verificando estado del despliegue ==="

# Verificar conectividad
echo "1. Verificando conectividad a servicios..."
curl -f http://192.168.11.7:6000/health || echo "API Gateway no responde"
curl -f http://192.168.11.7:6001/health || echo "Auth Service no responde"
curl -f http://192.168.11.7:6003/health || echo "WebSocket Server no responde"

# Verificar contenedores
echo "\n2. Estado de contenedores Docker:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Verificar logs recientes
echo "\n3. Logs recientes de servicios:"
echo "--- API Gateway ---"
docker logs --tail 10 microservicios-arquitectura-api-gateway-1 2>/dev/null || echo "No se encontraron logs del API Gateway"

echo "\n--- Auth Service ---"
docker logs --tail 10 microservicios-arquitectura-auth-service-1 2>/dev/null || echo "No se encontraron logs del Auth Service"

echo "\n--- WebSocket Server ---"
docker logs --tail 10 microservicios-arquitectura-websocket-server-1 2>/dev/null || echo "No se encontraron logs del WebSocket Server"

echo "\n--- MongoDB ---"
docker logs --tail 10 microservicios-arquitectura-mongo-1 2>/dev/null || echo "No se encontraron logs de MongoDB"

echo "\n=== Verificación completada ==="