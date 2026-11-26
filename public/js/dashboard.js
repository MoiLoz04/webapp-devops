const $ = (id) => document.getElementById(id);

const token = sessionStorage.getItem('access_token');

let usuarioActual = null;

// ==========================================
// SESION Y AUTENTICACION
// ==========================================

function cerrarSesionLocal() {
  sessionStorage.removeItem('access_token');
  window.location.replace('/');
}

function notificar(texto, error = false) {
  $('mensaje').textContent = texto;
  $('mensaje').className = error ? 'error' : 'success';
}

async function api(ruta, metodo = 'GET', datos) {

  const respuesta = await fetch('/api' + ruta, {
    method: metodo,

    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },

    body: datos === undefined
      ? undefined
      : JSON.stringify(datos)
  });

  if (respuesta.status === 401) {
    cerrarSesionLocal();
    throw new Error('Sesión inválida o expirada');
  }

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      resultado.message ||
      resultado.data?.mensaje ||
      'Error en la operación'
    );
  }

  return resultado;
}

function esAdmin() {
  return usuarioActual?.rol === 'admin';
}

// ==========================================
// INTERFAZ SEGUN EL ROL
// ==========================================

function configurarInterfaz() {

  const admin = esAdmin();

  $('nombreUsuario').textContent = usuarioActual.nombre;

  $('rolUsuario').textContent = admin
    ? 'ADMINISTRADOR'
    : 'USUARIO';

  $('tituloPanel').textContent = admin
    ? 'Panel de administración'
    : 'Panel de usuario';

  $('descripcionPanel').textContent = admin
    ? 'Gestión de inventario y usuarios'
    : 'Consulta de productos y categorías';

  $('tituloProductos').textContent = admin
    ? 'Gestión de productos'
    : 'Consulta de productos';

  $('tituloCategorias').textContent = admin
    ? 'Gestión de categorías'
    : 'Consulta de categorías';

  document.querySelectorAll('.admin-only')
    .forEach(elemento => {
      elemento.hidden = !admin;
    });

  document.querySelectorAll('.user-only')
    .forEach(elemento => {
      elemento.hidden = admin;
    });

  if (!admin) {
    $('usuarios').hidden = true;
    $('sistema').hidden = true;
  }
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function celda(fila, valor) {

  const td = document.createElement('td');

  td.textContent = valor ?? '';

  fila.appendChild(td);

  return td;
}

function botonAccion(
  contenedor,
  texto,
  accion,
  peligro = false
) {

  const boton = document.createElement('button');

  boton.textContent = texto;
  boton.type = 'button';

  if (peligro) {
    boton.className = 'danger';
  }

  boton.addEventListener('click', async () => {

    try {
      await accion();
    } catch (error) {
      notificar(error.message, true);
    }

  });

  contenedor.appendChild(boton);
}

function mostrarSeccion(nombre) {

  if (!usuarioActual) return;

  const seccionesAdmin = ['usuarios', 'sistema'];

  if (
    seccionesAdmin.includes(nombre) &&
    !esAdmin()
  ) {
    notificar('Permisos insuficientes', true);
    return;
  }

  document.querySelectorAll('.section')
    .forEach(seccion => {
      seccion.hidden = seccion.id !== nombre;
    });

  document.querySelectorAll('[data-section]')
    .forEach(boton => {

      boton.classList.toggle(
        'active',
        boton.dataset.section === nombre
      );

    });
}

// ==========================================
// PRODUCTOS
// ==========================================

async function cargarProductos() {

  const resultado = await api('/productos');

  const productos = resultado.data;

  $('totalProductos').textContent = productos.length;

  $('tablaProductos').replaceChildren();

  productos.forEach(producto => {

    const fila = document.createElement('tr');

    celda(fila, producto.id);
    celda(fila, producto.nombre);

    celda(
      fila,
      Number(producto.precio).toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN'
      })
    );

    celda(fila, producto.stock);

    // Solo el administrador tiene acciones.

    if (esAdmin()) {

      const acciones = celda(fila, '');

      botonAccion(
        acciones,
        'Eliminar',
        async () => {

          if (!confirm('¿Eliminar este producto?')) {
            return;
          }

          await api(
            '/productos/' + producto.id,
            'DELETE'
          );

          await cargarProductos();

          notificar(
            'Producto eliminado correctamente'
          );

        },
        true
      );

    }

    $('tablaProductos').appendChild(fila);

  });

  if (productos.length === 0) {

    const fila = document.createElement('tr');

    const td = celda(
      fila,
      'No hay productos registrados'
    );

    td.colSpan = esAdmin() ? 5 : 4;

    $('tablaProductos').appendChild(fila);
  }
}

// ==========================================
// CATEGORIAS
// ==========================================

async function cargarCategorias() {

  const resultado = await api('/categorias');

  const categorias = resultado.data;

  $('totalCategorias').textContent = categorias.length;

  $('tablaCategorias').replaceChildren();

  categorias.forEach(categoria => {

    const fila = document.createElement('tr');

    celda(fila, categoria.id);
    celda(fila, categoria.nombre);

    // Solo el administrador tiene acciones.

    if (esAdmin()) {

      const acciones = celda(fila, '');

      botonAccion(
        acciones,
        'Eliminar',
        async () => {

          if (!confirm('¿Eliminar esta categoría?')) {
            return;
          }

          await api(
            '/categorias/' + categoria.id,
            'DELETE'
          );

          await cargarCategorias();

          notificar(
            'Categoría eliminada correctamente'
          );

        },
        true
      );

    }

    $('tablaCategorias').appendChild(fila);

  });

  if (categorias.length === 0) {

    const fila = document.createElement('tr');

    const td = celda(
      fila,
      'No hay categorías registradas'
    );

    td.colSpan = esAdmin() ? 3 : 2;

    $('tablaCategorias').appendChild(fila);
  }
}

// ==========================================
// ADMINISTRACION DE USUARIOS
// ==========================================

function limpiarFormularioUsuario() {

  $('formUsuario').reset();

  $('usuarioId').value = '';

  $('usuarioEmail').disabled = false;

  $('usuarioPassword').disabled = false;
  $('usuarioPassword').required = true;

  $('tituloUsuario').textContent = 'Registrar usuario';

  $('cancelarEdicion').hidden = true;
}

function editarUsuario(usuario) {

  if (!esAdmin()) return;

  $('usuarioId').value = usuario.id;

  $('usuarioNombre').value = usuario.nombre;

  $('usuarioEmail').value = usuario.email;

  $('usuarioRol').value = usuario.rol;

  $('usuarioPassword').value = '';

  $('usuarioEmail').disabled = true;

  $('usuarioPassword').disabled = true;

  $('usuarioPassword').required = false;

  $('tituloUsuario').textContent = 'Editar usuario';

  $('cancelarEdicion').hidden = false;

  $('formUsuario').scrollIntoView({
    behavior: 'smooth'
  });
}

async function cargarUsuarios() {

  if (!esAdmin()) return;

  const resultado = await api('/usuarios');

  $('tablaUsuarios').replaceChildren();

  resultado.data.forEach(usuario => {

    const fila = document.createElement('tr');

    celda(fila, usuario.nombre);
    celda(fila, usuario.email);
    celda(fila, usuario.rol);

    const acciones = celda(fila, '');

    if (usuario.id !== usuarioActual.id) {

      botonAccion(
        acciones,
        'Editar',
        () => {
          editarUsuario(usuario);
        }
      );

      botonAccion(
        acciones,
        'Eliminar',
        async () => {

          if (!confirm('¿Eliminar este usuario?')) {
            return;
          }

          await api(
            '/usuarios/' + usuario.id,
            'DELETE'
          );

          await cargarUsuarios();

          notificar(
            'Usuario eliminado correctamente'
          );

        },
        true
      );

    } else {

      acciones.textContent = 'Sesión actual';

    }

    $('tablaUsuarios').appendChild(fila);

  });
}

// ==========================================
// ESTADO DEL SISTEMA
// ==========================================

async function verificarServidor() {

  if (!esAdmin()) return;

  const resultado = await api('/health');

  $('estadoServidor').textContent =
    resultado.data.estado;

  $('resultadoSistema').textContent =
    JSON.stringify(resultado, null, 2);
}

// ==========================================
// FORMULARIO DE PRODUCTOS
// ==========================================

$('formProducto').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    if (!esAdmin()) return;

    try {

      await api('/productos', 'POST', {

        nombre: $('productoNombre').value.trim(),

        precio: Number($('productoPrecio').value),

        stock: Number($('productoStock').value)

      });

      event.target.reset();

      await cargarProductos();

      notificar('Producto registrado correctamente');

    } catch (error) {

      notificar(error.message, true);

    }
  }
);

// ==========================================
// FORMULARIO DE CATEGORIAS
// ==========================================

$('formCategoria').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    if (!esAdmin()) return;

    try {

      await api('/categorias', 'POST', {

        nombre: $('categoriaNombre').value.trim()

      });

      event.target.reset();

      await cargarCategorias();

      notificar('Categoría registrada correctamente');

    } catch (error) {

      notificar(error.message, true);

    }
  }
);

// ==========================================
// FORMULARIO DE USUARIOS
// ==========================================

$('formUsuario').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    if (!esAdmin()) return;

    try {

      const id = $('usuarioId').value;

      const datos = {

        nombre: $('usuarioNombre').value.trim(),

        rol: $('usuarioRol').value

      };

      if (id) {

        await api(
          '/usuarios/' + id,
          'PUT',
          datos
        );

        notificar(
          'Usuario actualizado correctamente'
        );

      } else {

        datos.email =
          $('usuarioEmail').value.trim();

        datos.password =
          $('usuarioPassword').value;

        await api('/usuarios', 'POST', datos);

        notificar(
          'Usuario registrado correctamente'
        );

      }

      limpiarFormularioUsuario();

      await cargarUsuarios();

    } catch (error) {

      notificar(error.message, true);

    }
  }
);

$('cancelarEdicion').addEventListener(
  'click',
  limpiarFormularioUsuario
);

// ==========================================
// BOTON VERIFICAR SERVIDOR
// ==========================================

$('verificarHealth').addEventListener(
  'click',
  async () => {

    if (!esAdmin()) return;

    try {

      await verificarServidor();

      notificar(
        'Servidor funcionando correctamente'
      );

    } catch (error) {

      notificar(error.message, true);

    }
  }
);

// ==========================================
// BOTON SOLICITAR RESPALDO
// ==========================================

$('generarBackup').addEventListener(
  'click',
  async () => {

    if (!esAdmin()) return;

    try {

      const resultado = await api('/backup');

      $('resultadoSistema').textContent =
        JSON.stringify(resultado, null, 2);

      notificar(
        'Solicitud de respaldo completada'
      );

    } catch (error) {

      notificar(error.message, true);

    }
  }
);

// ==========================================
// CERRAR SESION
// ==========================================

$('logout').addEventListener(
  'click',
  async () => {

    try {

      await api('/auth/logout', 'POST');

    } catch (error) {

      console.warn(
        'No se confirmó el cierre remoto'
      );

    } finally {

      cerrarSesionLocal();

    }
  }
);

// ==========================================
// NAVEGACION
// ==========================================

document.querySelectorAll('[data-section]')
  .forEach(boton => {

    boton.addEventListener('click', async () => {

      if (!usuarioActual) return;

      try {

        const seccion = boton.dataset.section;

        if (
          ['usuarios', 'sistema'].includes(seccion) &&
          !esAdmin()
        ) {
          notificar('Permisos insuficientes', true);
          return;
        }

        $('mensaje').textContent = '';

        mostrarSeccion(seccion);

        if (seccion === 'inicio') {

          const tareas = [
            cargarProductos(),
            cargarCategorias()
          ];

          if (esAdmin()) {
            tareas.push(verificarServidor());
          }

          await Promise.all(tareas);
        }

        if (seccion === 'productos') {
          await cargarProductos();
        }

        if (seccion === 'categorias') {
          await cargarCategorias();
        }

        if (seccion === 'usuarios' && esAdmin()) {
          await cargarUsuarios();
        }

        if (seccion === 'sistema' && esAdmin()) {
          await verificarServidor();
        }

      } catch (error) {

        notificar(error.message, true);

      }
    });
  });

// ==========================================
// INICIALIZACION DEL DASHBOARD
// ==========================================

async function iniciar() {

  if (!token) {

    cerrarSesionLocal();

    return;
  }

  try {

    const resultado = await api('/auth/me');

    usuarioActual = resultado.data;

    if (
      !usuarioActual ||
      !['admin', 'usuario'].includes(usuarioActual.rol)
    ) {
      cerrarSesionLocal();
      return;
    }

    configurarInterfaz();

    mostrarSeccion('inicio');

    const tareas = [

      cargarProductos(),

      cargarCategorias()

    ];

    // El usuario normal no consulta el sistema.

    if (esAdmin()) {

      tareas.push(verificarServidor());

    }

    await Promise.all(tareas);

  } catch (error) {

    notificar(error.message, true);

  }
}

iniciar();