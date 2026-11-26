
const net = require('net');
const { crearCliente } = require('./supabase');

const responder = (socket, statusCode, data) => {
  socket.write(
    JSON.stringify({ statusCode, data }) + '\n'
  );
};

async function procesar(socket, linea) {
  try {
    let msg;

    try {
      msg = JSON.parse(linea);
    } catch {
      return responder(socket, 400, {
        mensaje: 'Formato JSON invalido'
      });
    }

    if (!msg || typeof msg.token !== 'string' || !msg.token.trim()) {
      return responder(socket, 401, {
        mensaje: 'Autenticacion requerida'
      });
    }

    const supabase = crearCliente(msg.token);

    const { data: auth, error: authError } =
      await supabase.auth.getUser(msg.token);

    if (authError || !auth.user) {
      return responder(socket, 401, {
        mensaje: 'Sesion invalida'
      });
    }

    const { data: perfil, error: perfilError } =
      await supabase
        .from('profiles')
        .select('rol')
        .eq('id', auth.user.id)
        .single();

    if (perfilError || !perfil) {
      return responder(socket, 403, {
        mensaje: 'Perfil no disponible'
      });
    }

    // Consultar productos o categorias
    if (['productos', 'categorias'].includes(msg.get)) {
      const columnas = msg.get === 'productos'
        ? 'id, nombre, precio, stock'
        : 'id, nombre';

      const { data, error } = await supabase
        .from(msg.get)
        .select(columnas)
        .order('id');

      if (error) {
        return responder(socket, 500, {
          mensaje: 'Error de consulta'
        });
      }

      return responder(socket, 200, data);
    }

    // Insertar registros
    if (msg.insert) {
      if (perfil.rol !== 'admin') {
        return responder(socket, 403, {
          mensaje: 'Permisos insuficientes'
        });
      }

      const { nombre, precio, stock = 0 } = msg.insert;

      if (typeof nombre !== 'string' || !nombre.trim()) {
        return responder(socket, 400, {
          mensaje: 'Nombre invalido'
        });
      }

      const esProducto = precio !== undefined;

      if (
        esProducto &&
        (
          typeof precio !== 'number' ||
          !Number.isFinite(precio) ||
          precio < 0 ||
          !Number.isInteger(stock) ||
          stock < 0
        )
      ) {
        return responder(socket, 400, {
          mensaje: 'Precio o stock invalido'
        });
      }

      const tabla = esProducto
        ? 'productos'
        : 'categorias';

      const registro = esProducto
        ? { nombre: nombre.trim(), precio, stock }
        : { nombre: nombre.trim() };

      const columnas = esProducto
        ? 'id, nombre, precio, stock'
        : 'id, nombre';

      const { data, error } = await supabase
        .from(tabla)
        .insert(registro)
        .select(columnas)
        .single();

      if (error) {
        const codigo = ['23505', '23514', '22P02']
          .includes(error.code) ? 400 : 500;

        return responder(socket, codigo, {
          mensaje: 'No fue posible insertar el registro'
        });
      }

      return responder(socket, 201, data);
    }

    return responder(socket, 400, {
      mensaje: 'Comando no reconocido'
    });

  } catch (error) {
    console.error('Error TCP:', error.message);

    if (!socket.destroyed) {
      responder(socket, 500, {
        mensaje: 'Error interno del servidor'
      });
    }
  }
}

const server = net.createServer((socket) => {
  console.log('Cliente TCP conectado');

  socket.setEncoding('utf8');
  socket.setTimeout(30000);

  let buffer = '';
  let cola = Promise.resolve();

  socket.on('data', (data) => {
    buffer += data;

    if (Buffer.byteLength(buffer, 'utf8') > 65536) {
      socket.destroy();
      return;
    }

    let indice;

    while ((indice = buffer.indexOf('\n')) !== -1) {
      const linea = buffer.slice(0, indice).trim();
      buffer = buffer.slice(indice + 1);

      if (linea) {
        cola = cola.then(() => procesar(socket, linea));
      }
    }
  });

  socket.on('timeout', () => socket.destroy());

  socket.on('end', () => {
    console.log('Cliente TCP desconectado');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error.message);
  });
});

const PORT = Number(process.env.TCP_PORT || 6061);
const HOST = process.env.TCP_HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(
    'Servidor TCP Socket corriendo en ' + HOST + ':' + PORT
  );
});

module.exports = server;
