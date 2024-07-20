const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json());
app.use(cors({
  origin: 'https://celebrated-cranachan-d80877.netlify.app',
  credentials: true
}));

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

pool.connect();

pool.query(`
  CREATE TABLE IF NOT EXISTS coordenadas (
    id SERIAL PRIMARY KEY,
    x NUMERIC,
    y NUMERIC,
    z NUMERIC,
    jogador VARCHAR(255),
    gps_ativo BOOLEAN DEFAULT true
  )
`, (err, res) => {
  if (err) {
    console.error('Erro ao criar a tabela "coordenadas":', err);
  } else {
    console.log('Tabela "coordenadas" verificada ou criada com sucesso.');
  }
});

app.get('/receberloc', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM coordenadas WHERE gps_ativo = true');
        client.release();
        if (result.rows.length > 0) {
            res.status(200).json(result.rows);
        } else {
            res.status(404).end('Nenhuma coordenada encontrada');
        }
    } catch (error) {
        console.error('Erro ao obter as coordenadas:', error);
        res.status(500).end('Erro interno do servidor');
    }
});

app.post('/receberloc', async (req, res) => {
    const data = req.body;
    if (!data.bairro || !data.jogador) {
        console.log('Erro: bairro ou jogador não definido');
        res.status(400).end('Erro: bairro ou jogador não definido');
        return;
    }
    console.log(`Localização recebida: x=${data.bairro.x}, y=${data.bairro.y}, z=${data.bairro.z}`);
    console.log(`Jogador: ${data.jogador}`);

    try {
        const upsertQuery = `
            INSERT INTO coordenadas (x, y, z, jogador, gps_ativo)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (jogador)
            DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, z = EXCLUDED.z, gps_ativo = true
        `;
        const values = [data.bairro.x, data.bairro.y, data.bairro.z, data.jogador];
        await pool.query(upsertQuery, values);
        io.emit('atualizarLocalizacao');
    } catch (error) {
        console.error('Erro ao inserir ou atualizar coordenadas no banco de dados:', error);
        res.status(500).end('Erro ao inserir ou atualizar coordenadas no banco de dados');
        return;
    }

    io.emit('atualizarLocalizacao', { x: data.bairro.x, y: data.bairro.y });

    res.status(200).json(data);
});

app.delete('/receberloc', async (req, res) => {
    const data = req.body;
    if (!data.jogador) {
        console.log('Erro: jogador não definido');
        res.status(400).end('Erro: jogador não definido');
        return;
    }
    console.log(`Desativando GPS do jogador: ${data.jogador}`);

    try {
        const updateQuery = 'UPDATE coordenadas SET gps_ativo = false WHERE jogador = $1';
        const values = [data.jogador];
        await pool.query(updateQuery, values);
        io.emit('atualizarLocalizacao');
    } catch (error) {
        console.error('Erro ao desativar GPS no banco de dados:', error);
        res.status(500).end('Erro ao desativar GPS no banco de dados');
        return;
    }

    res.status(200).end('GPS desativado com sucesso');
});

io.on('connection', (socket) => {
    console.log('Novo cliente conectado');
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor ouvindo na porta ${port}`);
});
