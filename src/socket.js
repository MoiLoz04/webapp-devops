const net = require('net');
const db  = require('./database');

const server = net.createServer((socket) => {
  console.log('Cliente TCP conectado');

  socket.on('data', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString().trim());
    } catch (e) {
      socket.write(JSON.stringify({ error: 'Formato invalido. Usa JSON.' }) + '\n');
      return;
    }

    // INSERT producto
    if (msg.insert && msg.insert.nombre && msg.insert.precio !== undefined) {
      try {
        const { nombre, precio, stock } = msg.insert;
        const r = db.prepare(
          'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)'
        ).run(nombre, precio, stock ?? 0);
        socket.write(JSON.stringify({
          statusCode: 201,
          data: { id: r.lastInsertRowid, nombre, precio, stock: stock ?? 0 }
        }) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ error: e.message }) + '\n');
      }

    // INSERT categoria
    } else if (msg.insert && msg.insert.nombre) {
      try {
        const { nombre } = msg.insert;
        const r = db.prepare('INSERT INTO categorias (nombre) VALUES (?)').run(nombre);
        socket.write(JSON.stringify({
          statusCode: 201,
          data: { id: r.lastInsertRowid, nombre }
        }) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ error: e.message }) + '\n');
      }

    // GET productos
    } else if (msg.get === 'productos') {
      const rows = db.prepare('SELECT * FROM productos').all();
      socket.write(JSON.stringify({ statusCode: 200, data: rows }) + '\n');

    // GET categorias
    } else if (msg.get === 'categorias') {
      const rows = db.prepare('SELECT * FROM categorias').all();
      socket.write(JSON.stringify({ statusCode: 200, data: rows }) + '\n');

    } else {
      socket.write(JSON.stringify({
        error: 'Comando no reconocido. Usa {insert:{...}} o {get:"productos"} o {get:"categorias"}'
      }) + '\n');
    }
  });

  socket.on('end', () => console.log('Cliente TCP desconectado'));
  socket.on('error', (err) => console.error('Socket error:', err.message));
});

server.listen(6061, '0.0.0.0', () => {
  console.log('Servidor TCP Socket corriendo en puerto 6061');
});

module.exports = server;