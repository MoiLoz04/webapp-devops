require('dotenv').config();

process.env.ALLOW_DATABASE_RESET = 'false';
process.env.TCP_PORT = '0';
process.env.TCP_HOST = '127.0.0.1';

const request = require('supertest');
const net = require('net');
const { randomUUID } = require('crypto');
const app = require('./app');

jest.setTimeout(60000);

const prefijo = `QA-${randomUUID()}`;

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

const usuarioEmail = `${prefijo.toLowerCase()}@example.com`;
const usuarioPassword = randomUUID() + 'Aa1!';

const nombreProducto = `${prefijo}-Producto`;
const nombreCategoria = `${prefijo}-Categoria`;

let adminToken;
let usuarioToken;
let usuarioId;
let adminId;
let productoId;
let categoriaId;
let servidorTCP;

const productosCreados = new Set();
const categoriasCreadas = new Set();
const usuariosCreados = new Set();

function peticion(metodo, ruta, token) {
  const req = request(app)[metodo](ruta);

  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }

  return req;
}

async function login(email, password) {
  return request(app)
    .post('/api/auth/login')
    .send({ email, password });
}

function verificar(res, codigo) {
  expect(res.status).toBe(codigo);
  expect(res.body.statusCode).toBe(codigo);
}

async function crearProducto(nombre = nombreProducto) {
  const res = await peticion(
    'post', '/api/productos', adminToken
  ).send({
    nombre,
    precio: 12500,
    stock: 10
  });

  if (res.body.data?.id && res.status === 201) {
    productosCreados.add(res.body.data.id);
  }

  verificar(res, 201);

  return res.body.data;
}

async function crearCategoria(nombre = nombreCategoria) {
  const res = await peticion(
    'post', '/api/categorias', adminToken
  ).send({ nombre });

  if (res.body.data?.id && res.status === 201) {
    categoriasCreadas.add(res.body.data.id);
  }

  verificar(res, 201);

  return res.body.data;
}

async function crearUsuario(email, nombre) {
  const res = await peticion(
    'post', '/api/usuarios', adminToken
  ).send({
    email,
    password: usuarioPassword,
    nombre,
    rol: 'usuario'
  });

  if (res.body.data?.id && res.status === 201) {
    usuariosCreados.add(res.body.data.id);
  }

  verificar(res, 201);

  return res.body.data;
}

function enviarTCP(mensaje) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: '127.0.0.1',
      port: servidorTCP.address().port
    });

    let buffer = '';

    socket.setEncoding('utf8');
    socket.setTimeout(20000);

    socket.on('connect', () => {
      const contenido =
        typeof mensaje === 'string'
          ? mensaje
          : JSON.stringify(mensaje);

      socket.write(contenido + '\n');
    });

    socket.on('data', data => {
      buffer += data;

      const indice = buffer.indexOf('\n');

      if (indice !== -1) {
        try {
          const respuesta = JSON.parse(
            buffer.slice(0, indice)
          );

          socket.destroy();
          resolve(respuesta);
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Tiempo de espera TCP agotado'));
    });

    socket.on('error', reject);

    socket.on('close', () => {
      reject(new Error('Conexion TCP cerrada'));
    });
  });
}

// ==========================================
// CONFIGURACION INICIAL
// ==========================================

beforeAll(async () => {
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'Configura TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD'
    );
  }

  const resAdmin = await login(
    adminEmail,
    adminPassword
  );

  verificar(resAdmin, 200);

  adminToken = resAdmin.body.data.access_token;
  adminId = resAdmin.body.data.usuario.id;

  expect(resAdmin.body.data.usuario.rol).toBe('admin');

  const usuario = await crearUsuario(
    usuarioEmail,
    `${prefijo}-Usuario`
  );

  usuarioId = usuario.id;

  const resUsuario = await login(
    usuarioEmail,
    usuarioPassword
  );

  verificar(resUsuario, 200);

  usuarioToken = resUsuario.body.data.access_token;

  const producto = await crearProducto();
  productoId = producto.id;

  const categoria = await crearCategoria();
  categoriaId = categoria.id;

  servidorTCP = require('./src/socket');

  if (!servidorTCP.listening) {
    await new Promise((resolve, reject) => {
      servidorTCP.once('listening', resolve);
      servidorTCP.once('error', reject);
    });
  }
});

// ==========================================
// LIMPIEZA DE REGISTROS DE PRUEBA
// ==========================================

afterAll(async () => {
  const errores = [];

  try {
    if (adminToken) {
      const grupos = [
        ['productos', productosCreados],
        ['categorias', categoriasCreadas],
        ['usuarios', usuariosCreados]
      ];

      for (const [ruta, registros] of grupos) {
        for (const id of registros) {
          try {
            const res = await peticion(
              'delete',
              `/api/${ruta}/${id}`,
              adminToken
            );

            if (![200, 404].includes(res.status)) {
              errores.push(`${ruta}/${id}: ${res.status}`);
            }
          } catch (error) {
            errores.push(`${ruta}/${id}: ${error.message}`);
          }
        }
      }
    }
  } finally {
    if (servidorTCP?.listening) {
      await new Promise(resolve => {
        servidorTCP.close(resolve);
      });
    }
  }

  if (errores.length) {
    throw new Error(
      'Registros pendientes de limpieza: ' +
      errores.join(', ')
    );
  }
});

// ==========================================
// MODULO 1: AUTENTICACION
// ==========================================

describe('Modulo 1 - Autenticacion', () => {

  test('TC001 - Login correcto del administrador', async () => {
    const res = await login(adminEmail, adminPassword);

    verificar(res, 200);
    expect(res.body.data.usuario.rol).toBe('admin');
    expect(res.body.data.access_token).toBeTruthy();
  });

  test('TC002 - Login correcto del usuario normal', async () => {
    const res = await login(usuarioEmail, usuarioPassword);

    verificar(res, 200);
    expect(res.body.data.usuario.rol).toBe('usuario');
  });

  test('TC003 - Rechazar credenciales incorrectas', async () => {
    const res = await login(
      usuarioEmail,
      randomUUID()
    );

    verificar(res, 401);
  });

  test('TC004 - Rechazar campos vacios', async () => {
    const res = await login('', '');

    verificar(res, 400);
  });

  test('TC005 - Rechazar solicitud sin token', async () => {
    const res = await request(app).get('/api/productos');

    verificar(res, 401);
  });

  test('TC006 - Rechazar token invalido', async () => {
    const res = await peticion(
      'get', '/api/productos', 'token-invalido'
    );

    verificar(res, 401);
  });

  test('TC007 - Consultar perfil del administrador', async () => {
    const res = await peticion(
      'get', '/api/auth/me', adminToken
    );

    verificar(res, 200);
    expect(res.body.data.id).toBe(adminId);
    expect(res.body.data.rol).toBe('admin');
  });

  test('TC008 - Consultar perfil del usuario normal', async () => {
    const res = await peticion(
      'get', '/api/auth/me', usuarioToken
    );

    verificar(res, 200);
    expect(res.body.data.id).toBe(usuarioId);
    expect(res.body.data.rol).toBe('usuario');
  });
});

// ==========================================
// MODULO 2: PRODUCTOS
// ==========================================

describe('Modulo 2 - Productos', () => {

  test('TC009 - Registrar producto correctamente', async () => {
    const producto = await crearProducto(
      `${prefijo}-NuevoProducto`
    );

    expect(producto.precio).toBe(12500);
    expect(producto.stock).toBe(10);
  });

  test('TC010 - Consultar productos registrados', async () => {
    const res = await peticion(
      'get', '/api/productos', adminToken
    );

    verificar(res, 200);

    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: productoId })
      ])
    );
  });

  test('TC011 - Consultar producto por ID', async () => {
    const res = await peticion(
      'get',
      `/api/productos/${productoId}`,
      adminToken
    );

    verificar(res, 200);
    expect(res.body.data.nombre).toBe(nombreProducto);
  });

  test('TC012 - Rechazar ID de producto invalido', async () => {
    const res = await peticion(
      'get', '/api/productos/invalido', adminToken
    );

    verificar(res, 404);
  });

  test('TC013 - Rechazar producto sin nombre', async () => {
    const res = await peticion(
      'post', '/api/productos', adminToken
    ).send({
      precio: 100,
      stock: 5
    });

    verificar(res, 400);
  });

  test('TC014 - Rechazar precio negativo', async () => {
    const res = await peticion(
      'post', '/api/productos', adminToken
    ).send({
      nombre: `${prefijo}-Invalido`,
      precio: -100,
      stock: 5
    });

    verificar(res, 400);
  });

  test('TC015 - Eliminar producto de prueba', async () => {
    const producto = await crearProducto(
      `${prefijo}-EliminarProducto`
    );

    const res = await peticion(
      'delete',
      `/api/productos/${producto.id}`,
      adminToken
    );

    verificar(res, 200);
    productosCreados.delete(producto.id);

    const consulta = await peticion(
      'get',
      `/api/productos/${producto.id}`,
      adminToken
    );

    verificar(consulta, 404);
  });
});

// ==========================================
// MODULO 3: CATEGORIAS
// ==========================================

describe('Modulo 3 - Categorias', () => {

  test('TC016 - Registrar categoria', async () => {
    const categoria = await crearCategoria(
      `${prefijo}-NuevaCategoria`
    );

    expect(categoria.id).toBeTruthy();
  });

  test('TC017 - Consultar categorias', async () => {
    const res = await peticion(
      'get', '/api/categorias', adminToken
    );

    verificar(res, 200);

    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: categoriaId })
      ])
    );
  });

  test('TC018 - Rechazar categoria vacia', async () => {
    const res = await peticion(
      'post', '/api/categorias', adminToken
    ).send({ nombre: '' });

    verificar(res, 400);
  });

  test('TC019 - Rechazar categoria duplicada', async () => {
    const res = await peticion(
      'post', '/api/categorias', adminToken
    ).send({ nombre: nombreCategoria });

    if (res.status === 201 && res.body.data?.id) {
      categoriasCreadas.add(res.body.data.id);
    }

    verificar(res, 400);
  });

  test('TC020 - Eliminar categoria de prueba', async () => {
    const categoria = await crearCategoria(
      `${prefijo}-EliminarCategoria`
    );

    const res = await peticion(
      'delete',
      `/api/categorias/${categoria.id}`,
      adminToken
    );

    verificar(res, 200);
    categoriasCreadas.delete(categoria.id);
  });
});

// ==========================================
// MODULO 4: USUARIOS
// ==========================================

describe('Modulo 4 - Administracion de usuarios', () => {

  test('TC021 - Crear usuario correctamente', async () => {
    const usuario = await crearUsuario(
      `${randomUUID()}@example.com`,
      `${prefijo}-NuevoUsuario`
    );

    expect(usuario.rol).toBe('usuario');
  });

  test('TC022 - Consultar listado de usuarios', async () => {
    const res = await peticion(
      'get', '/api/usuarios', adminToken
    );

    verificar(res, 200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('TC023 - Consultar usuario por ID', async () => {
    const res = await peticion(
      'get',
      `/api/usuarios/${usuarioId}`,
      adminToken
    );

    verificar(res, 200);
    expect(res.body.data.email).toBe(usuarioEmail);
  });

  test('TC024 - Actualizar nombre del usuario', async () => {
    const nombre = `${prefijo}-Actualizado`;

    const res = await peticion(
      'put',
      `/api/usuarios/${usuarioId}`,
      adminToken
    ).send({
      nombre,
      rol: 'usuario'
    });

    verificar(res, 200);
    expect(res.body.data.nombre).toBe(nombre);
  });

  test('TC025 - Rechazar datos de usuario invalidos', async () => {
    const res = await peticion(
      'post', '/api/usuarios', adminToken
    ).send({
      email: 'correo-invalido',
      password: '123',
      nombre: '',
      rol: 'invalido'
    });

    verificar(res, 400);
  });

  test('TC026 - Rechazar ID de usuario invalido', async () => {
    const res = await peticion(
      'get', '/api/usuarios/invalido', adminToken
    );

    verificar(res, 400);
  });

  test('TC027 - Eliminar usuario temporal', async () => {
    const usuario = await crearUsuario(
      `${randomUUID()}@example.com`,
      `${prefijo}-EliminarUsuario`
    );

    const res = await peticion(
      'delete',
      `/api/usuarios/${usuario.id}`,
      adminToken
    );

    verificar(res, 200);
    usuariosCreados.delete(usuario.id);
  });
});

// ==========================================
// MODULO 5: SEGURIDAD Y PERMISOS
// ==========================================

describe('Modulo 5 - Seguridad y permisos', () => {

  test('TC028 - Usuario normal puede consultar productos', async () => {
    const res = await peticion(
      'get', '/api/productos', usuarioToken
    );

    verificar(res, 200);
  });

  test('TC029 - Usuario normal puede consultar categorias', async () => {
    const res = await peticion(
      'get', '/api/categorias', usuarioToken
    );

    verificar(res, 200);
  });

  test('TC030 - Usuario normal no puede crear productos', async () => {
    const res = await peticion(
      'post', '/api/productos', usuarioToken
    ).send({
      nombre: `${prefijo}-NoPermitido`,
      precio: 100,
      stock: 1
    });

    if (res.status === 201 && res.body.data?.id) {
      productosCreados.add(res.body.data.id);
    }

    verificar(res, 403);
  });

  test('TC031 - Usuario normal no puede eliminar productos', async () => {
    const res = await peticion(
      'delete',
      `/api/productos/${productoId}`,
      usuarioToken
    );

    verificar(res, 403);
  });

  test('TC032 - Usuario normal no puede crear categorias', async () => {
    const res = await peticion(
      'post', '/api/categorias', usuarioToken
    ).send({
      nombre: `${prefijo}-NoPermitida`
    });

    if (res.status === 201 && res.body.data?.id) {
      categoriasCreadas.add(res.body.data.id);
    }

    verificar(res, 403);
  });

  test('TC033 - Usuario normal no puede eliminar categorias', async () => {
    const res = await peticion(
      'delete',
      `/api/categorias/${categoriaId}`,
      usuarioToken
    );

    verificar(res, 403);
  });

  test('TC034 - Usuario normal no puede administrar usuarios', async () => {
    const res = await peticion(
      'get', '/api/usuarios', usuarioToken
    );

    verificar(res, 403);
  });

  test('TC035 - Usuario normal no puede generar respaldos', async () => {
    const res = await peticion(
      'get', '/api/backup', usuarioToken
    );

    verificar(res, 403);
  });

  test('TC036 - Usuario normal no puede vaciar la base de datos', async () => {
    const res = await peticion(
      'delete', '/api/vaciar', usuarioToken
    );

    verificar(res, 403);

    expect(res.body.message).toBe(
      'Permisos insuficientes'
    );
  });
});

// ==========================================
// MODULO 6: SISTEMA
// ==========================================

describe('Modulo 6 - Sistema y respaldo', () => {

  test('TC037 - Verificar estado del servidor', async () => {
    const res = await request(app).get('/api/health');

    verificar(res, 200);
    expect(res.body.data.estado).toBe('OK');
    expect(res.body.data.timestamp).toBeTruthy();
  });

  test('TC038 - Generar respaldo de informacion', async () => {
    const res = await peticion(
      'get', '/api/backup', adminToken
    );

    verificar(res, 200);

    expect(res.body.data.archivo).toBe(
      'backup_database.json'
    );

    expect(res.body.data.tamano_bytes).toBeGreaterThan(0);
  });

  test('TC039 - Bloquear vaciado incluso para administrador', async () => {
    expect(process.env.ALLOW_DATABASE_RESET).toBe('false');

    const res = await peticion(
      'delete', '/api/vaciar', adminToken
    );

    verificar(res, 403);

    expect(res.body.data.mensaje).toBe(
      'Vaciado de base de datos deshabilitado'
    );
  });
});

// ==========================================
// MODULO 7: COMUNICACION TCP
// ==========================================

describe('Modulo 7 - Comunicacion TCP', () => {

  test('TC040 - Consultar productos mediante TCP', async () => {
    const res = await enviarTCP({
      token: adminToken,
      get: 'productos'
    });

    expect(res.statusCode).toBe(200);

    expect(res.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: productoId })
      ])
    );
  });

  test('TC041 - Consultar categorias mediante TCP', async () => {
    const res = await enviarTCP({
      token: usuarioToken,
      get: 'categorias'
    });

    expect(res.statusCode).toBe(200);

    expect(res.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: categoriaId })
      ])
    );
  });

  test('TC042 - Rechazar solicitud TCP sin token', async () => {
    const res = await enviarTCP({
      get: 'productos'
    });

    expect(res.statusCode).toBe(401);
  });

  test('TC043 - Rechazar formato JSON invalido', async () => {
    const res = await enviarTCP('JSON_INVALIDO');

    expect(res.statusCode).toBe(400);
  });

  test('TC044 - Usuario normal no puede insertar mediante TCP', async () => {
    const res = await enviarTCP({
      token: usuarioToken,
      insert: {
        nombre: `${prefijo}-TCPNoPermitido`,
        precio: 100,
        stock: 1
      }
    });

    if (res.statusCode === 201 && res.data?.id) {
      productosCreados.add(res.data.id);
    }

    expect(res.statusCode).toBe(403);
  });

  test('TC045 - Administrador puede insertar mediante TCP', async () => {
    const res = await enviarTCP({
      token: adminToken,
      insert: {
        nombre: `${prefijo}-TCPProducto`,
        precio: 500,
        stock: 5
      }
    });

    if (res.statusCode === 201 && res.data?.id) {
      productosCreados.add(res.data.id);
    }

    expect(res.statusCode).toBe(201);
    expect(res.data.precio).toBe(500);
    expect(res.data.stock).toBe(5);
  });
});
describe('Validacion del bloqueo CI/CD', () => {
  test('Fallo controlado para verificar el bloqueo del despliegue', () => {
    expect(true).toBe(false);
  });
});
