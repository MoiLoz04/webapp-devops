
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;

const publicKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publicKey) {
  throw new Error('Faltan las credenciales de Supabase');
}

const options = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
};

function crearCliente(token = null) {
  return createClient(url, publicKey, {
    ...options,
    global: {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {}
    }
  });
}

function crearClienteAdmin() {
  if (!secretKey) {
    throw new Error('Falta la clave privada de Supabase');
  }

  return createClient(url, secretKey, options);
}

module.exports = {
  crearCliente,
  crearClienteAdmin
};
