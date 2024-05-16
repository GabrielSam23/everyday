const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: 5432,
});

app.use(express.static('.'));
app.use(bodyParser.json());

app.post('/receberloc', async (req, res) => {
    const data = req.body;
    if (!data.bairro) {
        console.log('Erro: bairro não definido');
        res.status(400).end('Erro: bairro não definido');
        return;
    }
    console.log(`Localização recebida: x=${data.bairro.x}, y=${data.bairro.y}, z=${data.bairro.z}`);
    console.log(`Jogador: ${data.jogador}`);

    try {
        const client = await pool.connect();
        const queryText = 'INSERT INTO coordenadas (x, y, z, jogador) VALUES ($1, $2, $3, $4)';
        const values = [data.bairro.x, data.bairro.y, data.bairro.z, data.jogador];
        const result = await client.query(queryText, values);
        client.release();
        console.log('Coordenadas salvas no banco de dados.');
        io.emit('atualizarLocalizacao', { x: data.bairro.x, y: data.bairro.y });
        res.status(200).end('Coordenadas recebidas e salvas com sucesso.');
    } catch (err) {
        console.error('Erro ao salvar coordenadas no banco de dados:', err);
        res.status(500).end('Erro interno do servidor.');
    }
});

io.on('connection', (socket) => {
    console.log('Cliente WebSocket conectado');
    socket.on('disconnect', () => {
        console.log('Cliente WebSocket desconectado');
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor está rodando em http://localhost:${port}`);
});
