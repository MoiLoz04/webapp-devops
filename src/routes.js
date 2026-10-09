const express = require('express');
const router = express.Router();
const db = require('./database');
const fs = require('fs');
const path = require('path');

const resp = (res, data, code = 200) =>
  res.status(code).json({ statusCode: code, data });

// 1. GET /productos
router.get('/productos', (req, res) => {
  resp(res, db.prepare('SELECT * FROM productos').all());
});

// 2. GET /productos/:id
router.get('/productos/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!row) return resp(res, { mensaje: 'No encontrado' }, 404);
  resp(res, row);
});

// 3. POST /productos
router.post('/productos', (req, res) => {
  const { nombre, precio, stock } = req.body;
  if (!nombre || precio == null) return resp(res, { mensaje: 'Faltan campos' }, 400);
  const r = db.prepare('INSERT INTO productos (nombre,precio,stock) VALUES (?,?,?)').run(nombre, precio, stock ?? 0);
  resp(res, { id: r.lastInsertRowid, nombre, precio, stock: stock ?? 0 }, 201);
});

// 4. DELETE /productos/:id
router.delete('/productos/:id', (req, res) => {
  const r = db.prepare('DELETE FROM productos WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return resp(res, { mensaje: 'No encontrado' }, 404);
  resp(res, { mensaje: 'Eliminado correctamente' });
});

// 5. GET /categorias
router.get('/categorias', (req, res) => {
  resp(res, db.prepare('SELECT * FROM categorias').all());
});

// 6. POST /categorias
router.post('/categorias', (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return resp(res, { mensaje: 'Falta el nombre' }, 400);
  
  // Captura de errores 500 por si existe una restricción de registros duplicados (UNIQUE)
  try {
    const r = db.prepare('INSERT INTO categorias (nombre) VALUES (?)').run(nombre);
    resp(res, { id: r.lastInsertRowid, nombre }, 201);
  } catch (error) {
    resp(res, { mensaje: 'La categoría ya existe o es inválida' }, 400);
  }
});

// 7. DELETE /categorias/:id
router.delete('/categorias/:id', (req, res) => {
  const r = db.prepare('DELETE FROM categorias WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return resp(res, { mensaje: 'No encontrado' }, 404);
  resp(res, { mensaje: 'Categoria eliminada' });
});

// 8. GET /health
router.get('/health', (req, res) => {
  resp(res, { estado: 'OK', timestamp: new Date().toISOString() });
});

// 9. GET /backup — ¡MODIFICADO CON TAMAÑO EN BYTES!
router.get('/backup', (req, res) => {
  const src = path.resolve('./database.sqlite');
  if (!fs.existsSync(src)) {
    return resp(res, { mensaje: 'Base de datos no encontrada' }, 404);
  }
  
  // Obtenemos los metadatos del archivo para extraer los bytes reales
  const stats = fs.statSync(src);
  
  resp(res, { 
    archivo: 'backup_database.sqlite',
    tamano_bytes: stats.size // Retorna un número entero mayor a 0
  });
});

// 10. DELETE /vaciar
router.delete('/vaciar', (req, res) => {
  db.prepare('DELETE FROM productos').run();
  db.prepare('DELETE FROM categorias').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('productos','categorias')").run();
  resp(res, { mensaje: 'Base de datos vaciada correctamente' });
});

module.exports = router;
