
const express = require('express');
const router = express.Router();
const { autenticar, soloAdmin } = require('./auth');

const resp = (res, data, code = 200) =>
  res.status(code).json({ statusCode: code, data });

const errorDB = (res, error) => {
  console.error('Error de base de datos:', error.code);

  if (['23505', '23502', '23514', '22P02'].includes(error.code)) {
    return resp(res, {
      mensaje: 'Registro duplicado o datos invalidos'
    }, 400);
  }

  return resp(res, {
    mensaje: 'Error de base de datos'
  }, 500);
};

const idValido = (id) =>
  /^\d+$/.test(id) &&
  Number.isSafeInteger(Number(id)) &&
  Number(id) > 0;

// 1. GET /productos
router.get('/productos', autenticar, async (req, res) => {
  const { data, error } = await req.supabase
    .from('productos')
    .select('id, nombre, precio, stock')
    .order('id');

  if (error) return errorDB(res, error);

  return resp(res, data);
});

// 2. GET /productos/:id
router.get('/productos/:id', autenticar, async (req, res) => {
  if (!idValido(req.params.id)) {
    return resp(res, { mensaje: 'No encontrado' }, 404);
  }

  const { data, error } = await req.supabase
    .from('productos')
    .select('id, nombre, precio, stock')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return errorDB(res, error);

  if (!data) {
    return resp(res, { mensaje: 'No encontrado' }, 404);
  }

  return resp(res, data);
});

// 3. POST /productos
router.post('/productos', autenticar, soloAdmin, async (req, res) => {
  const { nombre, precio, stock = 0 } = req.body || {};

  if (
    typeof nombre !== 'string' ||
    !nombre.trim() ||
    typeof precio !== 'number' ||
    !Number.isFinite(precio) ||
    precio < 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    return resp(res, {
      mensaje: 'Faltan campos o existen datos invalidos'
    }, 400);
  }

  const { data, error } = await req.supabase
    .from('productos')
    .insert({
      nombre: nombre.trim(),
      precio,
      stock
    })
    .select('id, nombre, precio, stock')
    .single();

  if (error) return errorDB(res, error);

  return resp(res, data, 201);
});

// 4. DELETE /productos/:id
router.delete('/productos/:id', autenticar, soloAdmin, async (req, res) => {
  if (!idValido(req.params.id)) {
    return resp(res, { mensaje: 'No encontrado' }, 404);
  }

  const { data, error } = await req.supabase
    .from('productos')
    .delete()
    .eq('id', req.params.id)
    .select('id')
    .maybeSingle();

  if (error) return errorDB(res, error);

  if (!data) {
    return resp(res, { mensaje: 'No encontrado' }, 404);
  }

  return resp(res, {
    mensaje: 'Eliminado correctamente'
  });
});

// 5. GET /categorias
router.get('/categorias', autenticar, async (req, res) => {
  const { data, error } = await req.supabase
    .from('categorias')
    .select('id, nombre')
    .order('id');

  if (error) return errorDB(res, error);

  return resp(res, data);
});

// 6. POST /categorias
router.post('/categorias', autenticar, soloAdmin, async (req, res) => {
  const { nombre } = req.body || {};

  if (typeof nombre !== 'string' || !nombre.trim()) {
    return resp(res, {
      mensaje: 'Falta el nombre'
    }, 400);
  }

  const { data, error } = await req.supabase
    .from('categorias')
    .insert({ nombre: nombre.trim() })
    .select('id, nombre')
    .single();

  if (error) return errorDB(res, error);

  return resp(res, data, 201);
});

// 7. DELETE /categorias/:id
router.delete('/categorias/:id', autenticar, soloAdmin, async (req, res) => {
  if (!idValido(req.params.id)) {
    return resp(res, { mensaje: 'No encontrado' }, 404);
  }

  const { data, error } = await req.supabase
    .from('categorias')
    .delete()
    .eq('id', req.params.id)
    .select('id')
    .maybeSingle();

  if (error) return errorDB(res, error);

  if (!data) {
    return resp(res, { mensaje: 'No encontrado' }, 404);
  }

  return resp(res, {
    mensaje: 'Categoria eliminada'
  });
});

// 8. GET /health
router.get('/health', (req, res) => {
  return resp(res, {
    estado: 'OK',
    timestamp: new Date().toISOString()
  });
});

// 9. GET /backup
router.get('/backup', autenticar, soloAdmin, async (req, res) => {
  const { data, error } = await req.supabase
    .rpc('generar_backup');

  if (error) return errorDB(res, error);

  const contenido = JSON.stringify(data, null, 2);

  if (req.query.descargar === 'true') {
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="backup_database.json"'
    );

    return res.type('application/json').send(contenido);
  }

  return resp(res, {
    archivo: 'backup_database.json',
    tamano_bytes: Buffer.byteLength(contenido, 'utf8')
  });
});

// 10. DELETE /vaciar
router.delete('/vaciar', autenticar, soloAdmin, async (req, res) => {
  if (process.env.ALLOW_DATABASE_RESET !== 'true') {
    return resp(res, {
      mensaje: 'Vaciado de base de datos deshabilitado'
    }, 403);
  }

  const { error } = await req.supabase
    .rpc('vaciar_inventario');

  if (error) return errorDB(res, error);

  return resp(res, {
    mensaje: 'Base de datos vaciada correctamente'
  });
});

module.exports = router;
