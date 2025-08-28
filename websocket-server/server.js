const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Configuración de CORS para permitir conexiones desde cualquier origen
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Puerto del servidor
const PORT = process.env.PORT || 6003;

// Almacenamiento en memoria para el historial de deployments
let deploymentHistory = [];
let latestVersion = null;

// Función para guardar historial en archivo
const saveHistoryToFile = () => {
    try {
        const historyFile = path.join(__dirname, 'deployment-history.json');
        fs.writeFileSync(historyFile, JSON.stringify({
            deploymentHistory,
            latestVersion
        }, null, 2));
    } catch (error) {
        console.error('Error guardando historial:', error);
    }
};

// Función para cargar historial desde archivo
const loadHistoryFromFile = () => {
    try {
        const historyFile = path.join(__dirname, 'deployment-history.json');
        if (fs.existsSync(historyFile)) {
            const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
            deploymentHistory = data.deploymentHistory || [];
            latestVersion = data.latestVersion || null;
            console.log(`📋 Historial cargado: ${deploymentHistory.length} deployments`);
        }
    } catch (error) {
        console.error('Error cargando historial:', error);
    }
};

// Cargar historial al iniciar
loadHistoryFromFile();

// Contador de clientes conectados
let connectedClients = 0;

// Eventos de WebSocket
io.on('connection', (socket) => {
    connectedClients++;
    console.log(`🔌 Cliente conectado. Total: ${connectedClients}`);
    console.log(`   ID: ${socket.id}`);
    console.log(`   IP: ${socket.handshake.address}`);
    
    // Enviar historial al cliente recién conectado
    if (deploymentHistory.length > 0) {
        socket.emit('deployment-history', deploymentHistory.slice(-10)); // Últimos 10
    }
    
    // Enviar versión actual si existe
    if (latestVersion) {
        socket.emit('latest-version', { latestVersion });
    }
    
    socket.on('disconnect', () => {
        connectedClients--;
        console.log(`❌ Cliente desconectado. Total: ${connectedClients}`);
    });
    
    // Evento para verificar conexión
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
    });
});

// Endpoint para recibir notificaciones de Jenkins
app.post('/notify-deployment', (req, res) => {
    try {
        console.log('🚀 Notificación de deployment recibida de Jenkins:');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        const {
            buildNumber,
            gitCommit,
            project = 'react-actualizable',
            status = 'success',
            deployUrl = 'http://192.168.11.7:2000',
            timestamp = new Date().toISOString()
        } = req.body;
        
        // Crear objeto de versión
        const versionInfo = {
            version: `Build #${buildNumber}`,
            commit: gitCommit?.substring(0, 8) || 'unknown',
            fullCommit: gitCommit || 'unknown',
            project,
            status,
            deployUrl,
            timestamp,
            buildNumber: parseInt(buildNumber) || 0
        };
        
        // Actualizar versión actual
        latestVersion = versionInfo;
        
        // Agregar al historial
        deploymentHistory.push(versionInfo);
        
        // Mantener solo los últimos 50 deployments
        if (deploymentHistory.length > 50) {
            deploymentHistory = deploymentHistory.slice(-50);
        }
        
        // Guardar en archivo
        saveHistoryToFile();
        
        // Notificar a todos los clientes conectados
        if (status === 'success') {
            console.log(`📢 Enviando notificación a ${connectedClients} clientes`);
            io.emit('app-updated', versionInfo);
        }
        
        // Enviar historial actualizado
        io.emit('deployment-history', deploymentHistory.slice(-10));
        
        res.json({
            success: true,
            message: 'Notificación enviada correctamente',
            clientsNotified: connectedClients,
            versionInfo
        });
        
    } catch (error) {
        console.error('❌ Error procesando notificación:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para obtener la última versión
app.get('/latest-version', (req, res) => {
    res.json({
        latestVersion,
        deploymentHistory: deploymentHistory.slice(-5)
    });
});

// Endpoint para obtener estadísticas
app.get('/stats', (req, res) => {
    res.json({
        connectedClients,
        totalDeployments: deploymentHistory.length,
        latestVersion,
        serverUptime: process.uptime(),
        serverStartTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    });
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        connectedClients
    });
});

// Endpoint raíz con información del servidor
app.get('/', (req, res) => {
    res.json({
        name: 'WebSocket Notification Server',
        version: '1.0.0',
        status: 'running',
        connectedClients,
        endpoints: {
            'POST /notify-deployment': 'Recibe notificaciones de Jenkins',
            'GET /latest-version': 'Obtiene la última versión',
            'GET /stats': 'Estadísticas del servidor',
            'GET /health': 'Estado de salud del servidor'
        }
    });
});

// Manejo de errores
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ================================');
    console.log('🚀 WebSocket Notification Server');
    console.log('🚀 ================================');
    console.log(`🌐 Servidor ejecutándose en puerto ${PORT}`);
    console.log(`🔗 URL local: http://localhost:${PORT}`);
    console.log(`🔗 URL red: http://192.168.11.7:${PORT}`);
    console.log('📡 WebSocket listo para conexiones');
    console.log('🎯 Esperando notificaciones de Jenkins...');
    console.log('🚀 ================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Cerrando servidor...');
    saveHistoryToFile();
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Cerrando servidor...');
    saveHistoryToFile();
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
    });
});