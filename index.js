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
    jogador VARCHAR(255) UNIQUE
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
        const result = await client.query('SELECT * FROM coordenadas');
        client.release();
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao obter as coordenadas:', error);
        res.status(500).end('Erro interno do servidor');
    }
});

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
        const upsertQuery = `
            INSERT INTO coordenadas (x, y, z, jogador)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (jogador) 
            DO UPDATE SET x = $1, y = $2, z = $3
        `;
        const values = [data.bairro.x, data.bairro.y, data.bairro.z, data.jogador];
        await pool.query(upsertQuery, values);
    } catch (error) {
        console.error('Erro ao inserir/atualizar coordenadas no banco de dados:', error);
        res.status(500).end('Erro ao inserir/atualizar coordenadas no banco de dados');
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
    console.log(`Excluindo localização do jogador: ${data.jogador}`);

    try {
        const deleteQuery = 'DELETE FROM coordenadas WHERE jogador = $1';
        const values = [data.jogador];
        await pool.query(deleteQuery, values);
    } catch (error) {
        console.error('Erro ao excluir coordenadas no banco de dados:', error);
        res.status(500).end('Erro ao excluir coordenadas no banco de dados');
        return;
    }

    res.status(200).json({ message: 'Coordenadas excluídas com sucesso' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
