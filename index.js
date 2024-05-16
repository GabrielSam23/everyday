const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { Client } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuração do Body Parser para tratar requisições com JSON
app.use(bodyParser.json());

// Rota para a página hello.js
const helloRouter = require('./routes/hello');
app.use('/hello', helloRouter);

// Configuração do PostgreSQL
const client = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});
client.connect();

// Rota para receber coordenadas
app.post('/receberloc', async (req, res) => {
    const data = req.body;
    if (!data.bairro) {
        console.log('Erro: bairro não definido');
        res.status(400).end('Erro: bairro não definido');
        return;
    }
    console.log(`Localização recebida: x=${data.bairro.x}, y=${data.bairro.y}, z=${data.bairro.z}`);
    console.log(`Jogador: ${data.jogador}`);

    // Pegar os cinco primeiros dígitos de x e y
    const x = Math.round(data.bairro.x);
    const y = Math.round(data.bairro.y);
    const xFirstFiveDigits = String(x).substring(0, 5);
    const yFirstFiveDigits = String(y).substring(0, 5);

    // Atualizar as coordenadas para os cinco primeiros dígitos de x e y
    data.bairro.x = xFirstFiveDigits;
    data.bairro.y = yFirstFiveDigits;

    // Inserir coordenadas no banco de dados
    try {
        const insertQuery = 'INSERT INTO coordenadas (x, y, z, jogador) VALUES ($1, $2, $3, $4)';
        const values = [data.bairro.x, data.bairro.y, data.bairro.z, data.jogador];
        await client.query(insertQuery, values);
    } catch (error) {
        console.error('Erro ao inserir coordenadas no banco de dados:', error);
        res.status(500).end('Erro ao inserir coordenadas no banco de dados');
        return;
    }

    io.emit('atualizarLocalizacao', { x: data.bairro.x, y: data.bairro.y });

    res.end('Mensagem recebida pelo servidor');
});

// Configuração do Socket.IO
io.on('connection', (socket) => {
    console.log('Cliente WebSocket conectado');
    socket.on('atualizarLocalizacao', (data) => {
        socket.broadcast.emit('atualizarLocalizacao', data);
    });
    socket.on('disconnect', () => {
        console.log('Cliente WebSocket desconectado');
    });
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor está rodando em http://localhost:${PORT}`);
});
