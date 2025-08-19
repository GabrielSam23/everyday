const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://los-santos-transit.netlify.app",
    methods: ["GET", "POST"]
  }
});

app.use(bodyParser.json());
app.use(cors({
  origin: 'https://los-santos-transit.netlify.app',
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

// Adicionar esta conexão Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Enviar todas as localizações ativas quando um cliente se conecta
  socket.on('solicitarLocalizacoes', async () => {
    try {
      const result = await pool.query('SELECT * FROM coordenadas WHERE gps_ativo = true');
      socket.emit('todasLocalizacoes', result.rows);
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
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
            RETURNING *
        `;
        const values = [data.bairro.x, data.bairro.y, data.bairro.z, data.jogador];
        const result = await pool.query(upsertQuery, values);
        
        // Emitir para TODOS os clientes conectados
        io.emit('atualizarLocalizacao', result.rows[0]);
        
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao inserir/atualizar coordenadas:', error);
        res.status(500).end('Erro interno');
    }
});

app.delete('/receberloc', async (req, res) => {
    const data = req.body;
    if (!data.jogador) {
        res.status(400).end('Erro: jogador não definido');
        return;
    }

    try {
        await pool.query('UPDATE coordenadas SET gps_ativo = false WHERE jogador = $1', [data.jogador]);
        
        // Emitir remoção para todos os clientes
        io.emit('removerLocalizacao', data.jogador);
        
        res.status(200).end('GPS desativado com sucesso');
    } catch (error) {
        console.error('Erro ao desativar GPS:', error);
        res.status(500).end('Erro interno');
    }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor ouvindo na porta ${port}`);
});
