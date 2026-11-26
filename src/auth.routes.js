
const express = require('express');
const { crearCliente } = require('./supabase');
const { autenticar } = require('./auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Correo y contraseña requeridos'
      });
    }

    const supabase = crearCliente();

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

    if (error || !data.session) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Credenciales incorrectas'
      });
    }

    const cliente = crearCliente(
      data.session.access_token
    );

    const { data: perfil, error: errorPerfil } =
      await cliente
        .from('profiles')
        .select('id, nombre, rol')
        .eq('id', data.user.id)
        .single();

    if (errorPerfil || !perfil) {
      await supabase.auth.signOut();

      return res.status(403).json({
        statusCode: 403,
        message: 'Perfil no disponible'
      });
    }

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
      statusCode: 200,
      message: 'Inicio de sesion correcto',
      data: {
        usuario: {
          id: data.user.id,
          email: data.user.email,
          nombre: perfil.nombre,
          rol: perfil.rol
        },
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Error interno de autenticacion'
    });
  }
});

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({
    statusCode: 200,
    data: req.usuario
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (
      typeof refresh_token !== 'string' ||
      !refresh_token.trim()
    ) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Refresh token requerido'
      });
    }

    const supabase = crearCliente();

    const { data, error } =
      await supabase.auth.refreshSession({
        refresh_token
      });

    if (error || !data.session) {
      return res.status(401).json({
        statusCode: 401,
        message: 'No se pudo renovar la sesion'
      });
    }

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
      statusCode: 200,
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Error al renovar la sesion'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', autenticar, async (req, res) => {
  try {
    const token = req.headers.authorization
      .slice(7)
      .trim();

    const { error } =
      await req.supabase.auth.admin.signOut(
        token,
        'local'
      );

    if (error) {
      return res.status(400).json({
        statusCode: 400,
        message: 'No se pudo cerrar la sesion'
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Sesion cerrada correctamente'
    });

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Error al cerrar la sesion'
    });
  }
});

module.exports = router;
