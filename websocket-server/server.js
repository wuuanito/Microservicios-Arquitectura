const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Variables para estadísticas
let connectedClients = 0;
let deploymentHistory = [];

// Logging mejorado
const log = (message) => {
    console.log(`[${new Date().toISOString()}] ${message}`);
};

// Manejo de conexiones WebSocket
io.on('connection', (socket) => {
    connectedClients++;
    log(`Cliente conectado. Total conectados: ${connectedClients}`);
    
    // Enviar historial reciente al cliente que se conecta
    if (deploymentHistory.length > 0) {
        socket.emit('deployment-history', deploymentHistory.slice(-5));
    }
    
    socket.on('disconnect', () => {
        connectedClients--;
        log(`Cliente desconectado. Total conectados: ${connectedClients}`);
    });
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        connectedClients,
        uptime: process.uptime(),
        deploymentHistory: deploymentHistory.length
    });
});

// Endpoint que Jenkins llamará después del deploy
app.post('/notify-update', (req, res) => {
    const { version, timestamp, project } = req.body;
    
    if (!version) {
        return res.status(400).json({ 
            error: 'Version es requerida' 
        });
    }
    
    const deploymentData = {
        version,
        timestamp: timestamp || Date.now(),
        project: project || 'react-app',
        deployedAt: new Date().toISOString()
    };
    
    // Agregar al historial
    deploymentHistory.push(deploymentData);
    
    // Mantener solo los últimos 10 deployments
    if (deploymentHistory.length > 10) {
        deploymentHistory = deploymentHistory.slice(-10);
    }
    
    log(`Notificando nueva versión: ${version} del proyecto: ${project || 'react-app'}`);
    
    // Enviar notificación a todos los clientes conectados
    io.emit('app-updated', {
        ...deploymentData,
        message: 'Nueva versión disponible'
    });
    
    res.json({ 
        success: true, 
        clientsNotified: connectedClients,
        deploymentData
    });
});

// Endpoint para obtener la última versión
app.get('/latest-version', (req, res) => {
    const latestDeployment = deploymentHistory[deploymentHistory.length - 1];
    res.json({
        latestVersion: latestDeployment?.version || null,
        deployedAt: latestDeployment?.deployedAt || null,
        totalDeployments: deploymentHistory.length
    });
});

// Manejo de errores
app.use((err, req, res, next) => {
    log(`Error: ${err.message}`);
    res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 6003;

server.listen(PORT, '0.0.0.0', () => {
    log(`WebSocket server corriendo en puerto ${PORT}`);
    log(`Health check disponible en http://localhost:${PORT}/health`);
});