
const express = require('express');
const { crearClienteAdmin } = require('./supabase');
const { autenticar, soloAdmin } = require('./auth');

const router = express.Router();

router.use(autenticar, soloAdmin);

const ROLES = ['admin', 'usuario'];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responder(res, codigo, message, data) {
  return res.status(codigo).json({
    statusCode: codigo,
    message,
    ...(data !== undefined ? { data } : {})
  });
}

function formatoUsuario(user, perfil) {
  return {
    id: user.id,
    email: user.email,
    nombre: perfil?.nombre || '',
    rol: perfil?.rol || null,
    created_at: user.created_at
  };
}

router.param('id', (req, res, next, id) => {
  if (!UUID.test(id)) {
    return responder(res, 400, 'ID invalido');
  }

  next();
});

// GET /api/usuarios
router.get('/', async (req, res) => {
  try {
    const supabase = crearClienteAdmin();

    const page = Number(req.query.page || 1);

    if (!Number.isInteger(page) || page < 1) {
      return responder(res, 400, 'Pagina invalida');
    }

    const { data, error } =
      await supabase.auth.admin.listUsers({
        page,
        perPage: 100
      });

    if (error) throw error;

    if (!data.users.length) {
      return responder(res, 200, 'Usuarios recuperados', []);
    }

    const ids = data.users.map(user => user.id);

    const { data: perfiles, error: errorPerfiles } =
      await supabase
        .from('profiles')
        .select('id, nombre, rol')
        .in('id', ids);

    if (errorPerfiles) throw errorPerfiles;

    const usuarios = data.users.map(user =>
      formatoUsuario(
        user,
        perfiles.find(p => p.id === user.id)
      )
    );

    return responder(
      res, 200, 'Usuarios recuperados', usuarios
    );

  } catch (error) {
    return responder(res, 500, 'Error al listar usuarios');
  }
});

// GET /api/usuarios/:id
router.get('/:id', async (req, res) => {
  try {
    const supabase = crearClienteAdmin();

    const { data, error } =
      await supabase.auth.admin.getUserById(req.params.id);

    if (error) {
      if (error.status === 404) {
        return responder(res, 404, 'Usuario no encontrado');
      }

      throw error;
    }

    const { data: perfil, error: errorPerfil } =
      await supabase
        .from('profiles')
        .select('id, nombre, rol')
        .eq('id', req.params.id)
        .single();

    if (errorPerfil) throw errorPerfil;

    return responder(
      res,
      200,
      'Usuario encontrado',
      formatoUsuario(data.user, perfil)
    );

  } catch (error) {
    return responder(res, 500, 'Error al consultar usuario');
  }
});

// POST /api/usuarios
router.post('/', async (req, res) => {
  try {
    const { email, password, nombre } = req.body;
    const rol = req.body.rol ?? 'usuario';

    if (
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' ||
      password.length < 8 ||
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      !ROLES.includes(rol)
    ) {
      return responder(res, 400, 'Datos invalidos');
    }

    const supabase = crearClienteAdmin();

    const { data, error } =
      await supabase.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          nombre: nombre.trim()
        }
      });

    if (error) {
      if (
        error.code === 'email_exists' ||
        error.code === 'user_already_exists'
      ) {
        return responder(res, 409, 'El correo ya existe');
      }

      return responder(res, 400, 'No se pudo crear el usuario');
    }

    const id = data.user.id;

    // El trigger crea el perfil.
    // Actualizamos nombre y rol sin duplicarlo.
    const { data: perfil, error: errorPerfil } =
      await supabase
        .from('profiles')
        .update({
          nombre: nombre.trim(),
          rol
        })
        .eq('id', id)
        .select()
        .single();

    if (errorPerfil) {
      // Intentar revertir la creacion incompleta.
      const { error: errorRollback } =
        await supabase.auth.admin.deleteUser(id);

      if (errorRollback) {
        console.error('Usuario pendiente de reconciliar:', id);
      }

      return responder(
        res, 500, 'Error al configurar el perfil'
      );
    }

    return responder(
      res,
      201,
      'Usuario creado correctamente',
      formatoUsuario(data.user, perfil)
    );

  } catch (error) {
    return responder(res, 500, 'Error al crear usuario');
  }
});

// PUT /api/usuarios/:id
router.put('/:id', async (req, res) => {
  try {
    const { nombre, rol } = req.body;
    const id = req.params.id;

    if (
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      !ROLES.includes(rol)
    ) {
      return responder(res, 400, 'Datos invalidos');
    }

    if (id === req.usuario.id && rol !== 'admin') {
      return responder(
        res, 403, 'No puedes retirar tu propio rol admin'
      );
    }

    const supabase = crearClienteAdmin();

    const { data: usuario, error: errorUsuario } =
      await supabase.auth.admin.getUserById(id);

    if (errorUsuario) {
      if (errorUsuario.status === 404) {
        return responder(res, 404, 'Usuario no encontrado');
      }

      throw errorUsuario;
    }

    const { data: perfil, error } =
      await supabase
        .from('profiles')
        .update({
          nombre: nombre.trim(),
          rol
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    return responder(
      res,
      200,
      'Usuario actualizado correctamente',
      formatoUsuario(usuario.user, perfil)
    );

  } catch (error) {
    return responder(res, 500, 'Error al actualizar usuario');
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (id === req.usuario.id) {
      return responder(
        res, 403, 'No puedes eliminar tu propia cuenta'
      );
    }

    const supabase = crearClienteAdmin();

    const { error: errorUsuario } =
      await supabase.auth.admin.getUserById(id);

    if (errorUsuario) {
      if (errorUsuario.status === 404) {
        return responder(res, 404, 'Usuario no encontrado');
      }

      throw errorUsuario;
    }

    const { error } =
      await supabase.auth.admin.deleteUser(id);

    if (error) throw error;

    return responder(
      res, 200, 'Usuario eliminado correctamente'
    );

  } catch (error) {
    return responder(res, 500, 'Error al eliminar usuario');
  }
});

module.exports = router;
