const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('.'));
app.use(bodyParser.json());

app.post('/receberloc', (req, res) => {
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

    io.emit('atualizarLocalizacao', { x: data.bairro.x, y: data.bairro.y });

    res.end('Mensagem recebida pelo servidor');
});


app.get('/', (req, res) => {
    res.sendFile(__dirname + 'index.html');
});

io.on('connection', (socket) => {
    console.log('Cliente WebSocket conectado');
    socket.on('atualizarLocalizacao', (data) => {
        socket.broadcast.emit('atualizarLocalizacao', data);
    });
    socket.on('disconnect', () => {
        console.log('Cliente WebSocket desconectado');
    });
});

const port = 3000;
server.listen(port, () => {
    console.log(`Servidor está rodando em http://localhost:${port}`);
});
