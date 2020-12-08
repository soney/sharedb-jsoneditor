const http = require('http');
const express = require('express');
const ShareDB = require('sharedb');
const WebSocket = require('ws');
const WebSocketJSONStream = require('@teamwork/websocket-json-stream');


const backend = new ShareDB();
createDoc(startServer);

function createDoc(callback) {
    const connection = backend.connect();
    const doc = connection.get('examples', 'counter');
    doc.fetch((err) => {
        if(err) {
            throw err;
        }

        if(doc.type === null) {
            doc.create({numClicks: 0}, callback);
            return;
        }
        callback();
    })
}

function startServer() {
    const app = express();
    app.use(express.static('.'));
    const server = http.createServer(app);

    const wss = new WebSocket.Server({server});
    wss.on('connection', (ws) => {
        const stream = new WebSocketJSONStream(ws);
        backend.listen(stream);
    });
    app.use('/', (req, res) => {
        res.redirect('/static');
    })

    server.listen(8080);
    console.log('Listenening on http://localhost:8080/static');
}