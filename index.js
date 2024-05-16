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
  origin: 'https://maze-banksa.netlify.app',
  credentials: true
}));

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

pool.connect();

// Defina a rota para o endpoint /receberloc
app.get("/", async (req, res) => {
    res.status(200).json({
      title: "Express Testing",
      message: "The app is working properly!",
    });
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
        await pool.query(insertQuery, values);
    } catch (error) {
        console.error('Erro ao inserir coordenadas no banco de dados:', error);
        res.status(500).end('Erro ao inserir coordenadas no banco de dados');
        return;
    }

    io.emit('atualizarLocalizacao', { x: data.bairro.x, y: data.bairro.y });

    res.end('Mensagem recebida pelo servidor');
});

// Inicialize o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor está rodando em http://localhost:${PORT}`);
});
