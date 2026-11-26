
const { crearCliente } = require('./supabase');

async function autenticar(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Autenticacion requerida'
      });
    }

    const token = authorization.slice(7).trim();

    const supabase = crearCliente(token);

    const { data, error } =
      await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Sesion invalida o expirada'
      });
    }

    const { data: perfil, error: errorPerfil } =
      await supabase
        .from('profiles')
        .select('id, nombre, rol')
        .eq('id', data.user.id)
        .single();

    if (errorPerfil || !perfil) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Perfil no disponible'
      });
    }

    req.usuario = {
      id: data.user.id,
      email: data.user.email,
      nombre: perfil.nombre,
      rol: perfil.rol
    };

    req.supabase = supabase;

    next();

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Error de autenticacion'
    });
  }
}

function soloAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({
      statusCode: 403,
      message: 'Permisos insuficientes'
    });
  }

  next();
}

module.exports = {
  autenticar,
  soloAdmin
};
