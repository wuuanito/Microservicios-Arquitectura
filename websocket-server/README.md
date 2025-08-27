# WebSocket Notification Server

Servidor WebSocket para notificaciones en tiempo real de actualizaciones de la aplicación.

## Características

- **Notificaciones en tiempo real**: Envía notificaciones a todos los clientes conectados cuando hay una nueva versión
- **Historial de deployments**: Mantiene un historial de los últimos 10 deployments
- **Health check**: Endpoint para verificar el estado del servidor
- **Estadísticas**: Tracking de clientes conectados y uptime

## Endpoints

### GET /health
Verifica el estado del servidor y devuelve estadísticas.

**Respuesta:**
```json
{
  "status": "OK",
  "connectedClients": 5,
  "uptime": 3600,
  "deploymentHistory": 3
}
```

### POST /notify-update
Notifica una nueva actualización a todos los clientes conectados. Este endpoint es llamado por Jenkins después de un deployment.

**Body:**
```json
{
  "version": "v1.2.3",
  "project": "react-app",
  "timestamp": 1640995200000
}
```

**Respuesta:**
```json
{
  "success": true,
  "clientsNotified": 5,
  "deploymentData": {
    "version": "v1.2.3",
    "project": "react-app",
    "timestamp": 1640995200000,
    "deployedAt": "2023-12-31T12:00:00.000Z"
  }
}
```

### GET /latest-version
Obtiene información sobre la última versión deployada.

**Respuesta:**
```json
{
  "latestVersion": "v1.2.3",
  "deployedAt": "2023-12-31T12:00:00.000Z",
  "totalDeployments": 5
}
```

## Eventos WebSocket

### app-updated
Se emite cuando hay una nueva actualización disponible.

```javascript
socket.on('app-updated', (data) => {
  console.log('Nueva versión:', data.version);
  console.log('Proyecto:', data.project);
  console.log('Mensaje:', data.message);
});
```

### deployment-history
Se envía al cliente cuando se conecta, conteniendo los últimos 5 deployments.

```javascript
socket.on('deployment-history', (history) => {
  console.log('Historial:', history);
});
```

## Uso en Frontend

### Instalación
```bash
npm install socket.io-client
```

### Conexión
```javascript
import { io } from 'socket.io-client';

const socket = io('http://192.168.11.7:6003');

// Escuchar actualizaciones
socket.on('app-updated', (data) => {
  // Mostrar notificación al usuario
  showUpdateNotification(data.version);
});

// Manejar historial
socket.on('deployment-history', (history) => {
  console.log('Últimos deployments:', history);
});
```

## Configuración

### Variables de Entorno
- `PORT`: Puerto del servidor (default: 6003)
- `NODE_ENV`: Entorno de ejecución

### Docker
El servicio se ejecuta en el puerto 3001 dentro del contenedor y se expone en el puerto 6003 del host.

## Desarrollo

### Instalación
```bash
cd websocket-server
npm install
```

### Desarrollo local
```bash
npm run dev
```

### Producción
```bash
npm start
```

## Integración con Jenkins

Para integrar con Jenkins, agrega este step al final de tu pipeline:

```groovy
post {
  success {
    script {
      def version = env.BUILD_NUMBER
      def timestamp = System.currentTimeMillis()
      
      sh """
        curl -X POST http://192.168.11.7:6003/notify-update \
          -H 'Content-Type: application/json' \
          -d '{
            "version": "v${version}",
            "project": "${env.JOB_NAME}",
            "timestamp": ${timestamp}
          }'
      """
    }
  }
}
```