const request = require('supertest');
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api', require('./src/routes'));

beforeEach(async () => {
  await request(app).delete('/api/vaciar');
});
  
// ═══════════════════════════════════════════
// ENDPOINT 1 — POST /api/productos
// ═══════════════════════════════════════════
test('EP1-1: POST /api/productos - Debe crear producto y retornar 201', async () => {
  const res = await request(app)
    .post('/api/productos')
    .send({ nombre: 'Laptop', precio: 15000, stock: 5 });
  expect(res.statusCode).toBe(201);
  expect(res.body.data.nombre).toBe('Laptop');
});

test('EP1-2: POST /api/productos - Debe retornar 400 si falta el precio', async () => {
  const res = await request(app)
    .post('/api/productos')
    .send({ nombre: 'Tablet' });
  expect(res.statusCode).toBe(400);
});

test('EP1-3: POST /api/productos - Debe retornar 400 si falta el nombre', async () => {
  const res = await request(app)
    .post('/api/productos')
    .send({ precio: 500 });
  expect(res.statusCode).toBe(400);
});

// ═══════════════════════════════════════════
// ENDPOINT 2 — GET /api/productos
// ═══════════════════════════════════════════
test('EP2-1: GET /api/productos - Debe retornar 200 y un arreglo', async () => {
  const res = await request(app).get('/api/productos');
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});

test('EP2-2: GET /api/productos - Arreglo vacio si no hay productos', async () => {
  const res = await request(app).get('/api/productos');
  expect(res.statusCode).toBe(200);
  expect(res.body.data.length).toBe(0);
});

test('EP2-3: GET /api/productos - Debe retornar productos creados', async () => {
  await request(app).post('/api/productos').send({ nombre: 'Mouse', precio: 300, stock: 10 });
  const res = await request(app).get('/api/productos');
  expect(res.body.data.length).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════
// ENDPOINT 3 — GET /api/productos/:id
// ═══════════════════════════════════════════
test('EP3-1: GET /api/productos/:id - Debe retornar el producto correcto', async () => {
  const created = await request(app).post('/api/productos').send({ nombre: 'Monitor', precio: 5000, stock: 2 });
  const id = created.body.data.id;
  const res = await request(app).get(`/api/productos/${id}`);
  expect(res.statusCode).toBe(200);
  expect(res.body.data.nombre).toBe('Monitor');
});

test('EP3-2: GET /api/productos/:id - Debe retornar 404 si no existe', async () => {
  const res = await request(app).get('/api/productos/9999');
  expect(res.statusCode).toBe(404);
});

test('EP3-3: GET /api/productos/:id - Debe retornar 404 con id negativo', async () => {
  const res = await request(app).get('/api/productos/-1');
  expect(res.statusCode).toBe(404);
});

// ═══════════════════════════════════════════
// ENDPOINT 4 — DELETE /api/productos/:id
// ═══════════════════════════════════════════
test('EP4-1: DELETE /api/productos/:id - Debe eliminar y retornar 200', async () => {
  const created = await request(app).post('/api/productos').send({ nombre: 'Teclado', precio: 800, stock: 3 });
  const id = created.body.data.id;
  const res = await request(app).delete(`/api/productos/${id}`);
  expect(res.statusCode).toBe(200);
});

test('EP4-2: DELETE /api/productos/:id - Debe retornar 404 si no existe', async () => {
  const res = await request(app).delete('/api/productos/9999');
  expect(res.statusCode).toBe(404);
});

test('EP4-3: DELETE /api/productos/:id - Producto no debe existir tras eliminarlo', async () => {
  const created = await request(app).post('/api/productos').send({ nombre: 'Bocina', precio: 1200, stock: 1 });
  const id = created.body.data.id;
  await request(app).delete(`/api/productos/${id}`);
  const res = await request(app).get(`/api/productos/${id}`);
  expect(res.statusCode).toBe(404);
});

// ═══════════════════════════════════════════
// ENDPOINT 5 — POST /api/categorias
// ═══════════════════════════════════════════
test('EP5-1: POST /api/categorias - Debe crear categoria y retornar 201', async () => {
  const res = await request(app).post('/api/categorias').send({ nombre: 'Electronica' });
  expect(res.statusCode).toBe(201);
  expect(res.body.data.nombre).toBe('Electronica');
});

test('EP5-2: POST /api/categorias - Debe retornar 400 si falta el nombre', async () => {
  const res = await request(app).post('/api/categorias').send({});
  expect(res.statusCode).toBe(400);
});

test('EP5-3: POST /api/categorias - Debe retornar 400 si el nombre es un texto vacío', async () => {
  const res = await request(app).post('/api/categorias').send({ nombre: '' });
  expect(res.statusCode).toBe(400);
});

// ═══════════════════════════════════════════
// ENDPOINT 6 — GET /api/categorias
// ═══════════════════════════════════════════
test('EP6-1: GET /api/categorias - Debe retornar 200 y un arreglo', async () => {
  const res = await request(app).get('/api/categorias');
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});

test('EP6-2: GET /api/categorias - Arreglo vacio si no hay categorias', async () => {
  const res = await request(app).get('/api/categorias');
  expect(res.statusCode).toBe(200);
  expect(res.body.data.length).toBe(0);
});

test('EP6-3: GET /api/categorias - Debe retornar categorias creadas', async () => {
  await request(app).post('/api/categorias').send({ nombre: 'Libros' });
  const res = await request(app).get('/api/categorias');
  expect(res.body.data.length).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════
// ENDPOINT 7 — DELETE /api/categorias/:id
// ═══════════════════════════════════════════
test('EP7-1: DELETE /api/categorias/:id - Debe eliminar y retornar 200', async () => {
  const created = await request(app).post('/api/categorias').send({ nombre: 'Juguetes' });
  const id = created.body.data.id;
  const res = await request(app).delete(`/api/categorias/${id}`);
  expect(res.statusCode).toBe(200);
});

test('EP7-2: DELETE /api/categorias/:id - Debe retornar 404 si no existe', async () => {
  const res = await request(app).delete('/api/categorias/9999');
  expect(res.statusCode).toBe(404);
});

test('EP7-3: DELETE /api/categorias/:id - Categoria no debe existir tras eliminarse', async () => {
  const created = await request(app).post('/api/categorias').send({ nombre: 'Ferreteria' });
  const id = created.body.data.id;
  await request(app).delete(`/api/categorias/${id}`);
  const res = await request(app).get('/api/categorias');
  expect(res.body.data.length).toBe(0);
});

// ═══════════════════════════════════════════
// ENDPOINT 8 — GET /api/health
// ═══════════════════════════════════════════
test('EP8-1: GET /api/health - Debe retornar 200 y estado OK', async () => {
  const res = await request(app).get('/api/health');
  expect(res.statusCode).toBe(200);
  expect(res.body.data.estado).toBe('OK');
});

test('EP8-2: GET /api/health - Respuesta debe tener timestamp', async () => {
  const res = await request(app).get('/api/health');
  expect(res.body.data).toHaveProperty('timestamp');
});

test('EP8-3: GET /api/health - Timestamp debe ser una fecha valida', async () => {
  const res = await request(app).get('/api/health');
  const isValidDate = !isNaN(Date.parse(res.body.data.timestamp));
  expect(isValidDate).toBe(true);
});
//ok
// ═══════════════════════════════════════════
// ENDPOINT 9 — GET /api/backup
// ═══════════════════════════════════════════
test('EP9-1: GET /api/backup - Debe retornar 200', async () => {
  const res = await request(app).get('/api/backup');
  expect(res.statusCode).toBe(200);
});

test('EP9-2: GET /api/backup - Debe retornar nombre del archivo', async () => {
  const res = await request(app).get('/api/backup');
  expect(res.body.data.archivo).toBe('backup_database.sqlite');
});

test('EP9-3: GET /api/backup - Debe retornar el tamaño en bytes', async () => {
  const res = await request(app).get('/api/backup');
  expect(res.body.data.tamano_bytes).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════
// ENDPOINT 10 — DELETE /api/vaciar
// ═══════════════════════════════════════════
test('EP10-1: DELETE /api/vaciar - Debe retornar 200', async () => {
  const res = await request(app).delete('/api/vaciar');
  expect(res.statusCode).toBe(200);
});

test('EP10-2: DELETE /api/vaciar - Productos deben quedar vacios', async () => {
  await request(app).post('/api/productos').send({ nombre: 'Ropa', precio: 100 });
  await request(app).delete('/api/vaciar');
  const res = await request(app).get('/api/productos');
  expect(res.body.data.length).toBe(0);
});

test('EP10-3: DELETE /api/vaciar - Categorias deben quedar vacias', async () => {
  await request(app).post('/api/categorias').send({ nombre: 'Calzado' });
  await request(app).delete('/api/vaciar');
  const res = await request(app).get('/api/categorias');
  expect(res.body.data.length).toBe(0);
});
