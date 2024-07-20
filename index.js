// Importe as bibliotecas necessárias
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

// Crie uma instância do Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure o Body Parser para tratar requisições com JSON
app.use(bodyParser.json());
app.use(cors({
  origin: 'https://celebrated-cranachan-d80877.netlify.app/',
  credentials: true
}));

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

pool.connect();

// Cria a tabela 'coordenadas' se ela não existir
pool.query(`
  CREATE TABLE IF NOT EXISTS coordenadas (
    id SERIAL PRIMARY KEY,
    x NUMERIC,
    y NUMERIC,
    z NUMERIC,
    jogador VARCHAR(255)
  )
`, (err, res) => {
  if (err) {
    console.error('Erro ao criar a tabela "coordenadas":', err);
  } else {
    console.log('Tabela "coordenadas" verificada ou criada com sucesso.');
  }
});

// Rota GET para /receberloc
app.get('/receberloc', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM coordenadas ORDER BY id DESC LIMIT 1');
        client.release();
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).end('Nenhuma coordenada encontrada');
        }
    } catch (error) {
        console.error('Erro ao obter as coordenadas:', error);
        res.status(500).end('Erro interno do servidor');
    }
});

// Rota POST para /receberloc
app.post('/receberloc', async (req, res) => {
    const data = req.body;
    if (!data.bairro || !data.jogador) {
        console.log('Erro: bairro ou jogador não definido');
        res.status(400).end('Erro: bairro ou jogador não definido');
        return;
    }
    console.log(`Localização recebida: x=${data.bairro.x}, y=${data.bairro.y}, z=${data.bairro.z}`);
    console.log(`Jogador: ${data.jogador}`);

    // Inserir coordenadas no banco de dados
    try {
        const insertQuery = 'INSERT INTO coordenadas (x, y, z, jogador) VALUES ($1, $2, $3, $4)';
        const values = [data.bairro.x, data.bairro.y, data.bairro.z, data.jogador];
        await pool.query(insertQuery, values);
    } catch (error) {
        console.error('Erro ao inserir coordenadas no banco de dados:', error);
        res.status(500).end('Erro ao inserir coordenadas no banco de dados');
        return;
    }

    io.emit('atualizarLocalizacao', { x: data.bairro.x, y: data.bairro.y });

    // Responder com os dados recebidos
    res.status(200).json(data);
});

// Rota DELETE para /receberloc
app.delete('/receberloc', async (req, res) => {
    const data = req.body;
    if (!data.jogador) {
        console.log('Erro: jogador não definido');
        res.status(400).end('Erro: jogador não definido');
        return;
    }
    console.log(`Excluindo coordenadas do jogador: ${data.jogador}`);

    // Excluir coordenadas do banco de dados
    try {
        const deleteQuery = 'DELETE FROM coordenadas WHERE jogador = $1';
        const values = [data.jogador];
        await pool.query(deleteQuery, values);
    } catch (error) {
        console.error('Erro ao excluir coordenadas no banco de dados:', error);
        res.status(500).end('Erro ao excluir coordenadas no banco de dados');
        return;
    }

    // Responder com sucesso
    res.status(200).end('Coordenadas excluídas com sucesso');
});

// Iniciar o servidor
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor ouvindo na porta ${port}`);
});
