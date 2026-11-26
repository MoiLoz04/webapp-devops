
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

require('dotenv').config();

const admin = {
  email: process.env.TEST_ADMIN_EMAIL,
  password: process.env.TEST_ADMIN_PASSWORD
};

const sufijo = randomUUID().slice(0, 12);

const usuario = {
  nombre: `Usuario E2E ${sufijo}`,
  email: `e2e.${sufijo}@webapp.com`,
  password: `Prueba${randomUUID()}Aa1!`,
  rol: 'usuario'
};

const nombreProducto = `Producto E2E ${sufijo}`;
const nombreCategoria = `Categoria E2E ${sufijo}`;
const nombreUsuarioExtra = `Usuario extra ${sufijo}`;
const emailExtra = `extra.${sufijo}@webapp.com`;

let usuarioId;

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function loginAPI(request, credenciales) {
  const respuesta = await request.post('/api/auth/login', {
    data: {
      email: credenciales.email,
      password: credenciales.password
    }
  });

  expect(respuesta.status()).toBe(200);

  const json = await respuesta.json();

  return {
    Authorization: `Bearer ${json.data.access_token}`
  };
}

async function loginUI(page, credenciales, rol) {
  await page.goto('/');

  await page.locator('#email').fill(credenciales.email);
  await page.locator('#password').fill(credenciales.password);

  const [respuesta] = await Promise.all([
    page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/auth/login' &&
      response.request().method() === 'POST'
    ),
    page.locator('#loginButton').click()
  ]);

  expect(
    respuesta.status(),
    `Login HTTP para rol ${rol}`
  ).toBe(200);

  await expect(page).toHaveURL(/dashboard\.html/);

  const rolEsperado = rol === 'admin'
    ? /^\s*(admin|administrador)\s*$/i
    : /^\s*usuario\s*$/i;

  await expect(page.locator('#rolUsuario'))
    .toHaveText(rolEsperado);

  await expect(page.locator('main h1')).toContainText(
    rol === 'admin'
      ? /administraci/i
      : /Panel de usuario/i
  );

  const token = await page.evaluate(() =>
    sessionStorage.getItem('access_token')
  );

  expect(token).toBeTruthy();

  // Verificar permisos reales del usuario.
  const permisos = await page.request.get('/api/usuarios', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  expect(permisos.status())
    .toBe(rol === 'admin' ? 200 : 403);
}

async function abrirSeccion(page, nombre) {
  await page.locator(`[data-section="${nombre}"]`).click();

  await expect(page.locator(`#${nombre}`))
    .toBeVisible();
}

async function tokenUI(page) {
  const token = await page.evaluate(() =>
    sessionStorage.getItem('access_token')
  );

  return {
    Authorization: `Bearer ${token}`
  };
}

async function eliminarPorNombre(request, headers, ruta, nombre) {
  const respuesta = await request.get(`/api/${ruta}`, {
    headers
  });

  expect(respuesta.ok()).toBeTruthy();

  const json = await respuesta.json();

  for (const registro of json.data) {
    if (registro.nombre === nombre) {
      const eliminado = await request.delete(
        `/api/${ruta}/${registro.id}`,
        { headers }
      );

      expect(eliminado.ok()).toBeTruthy();
    }
  }
}

// ============================================
// PREPARACION DE PRUEBAS
// ============================================

test.beforeAll(async ({ request }) => {
  if (!admin.email || !admin.password) {
    throw new Error(
      'Configura TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en .env'
    );
  }

  const headers = await loginAPI(request, admin);

  const respuesta = await request.post('/api/usuarios', {
    headers,
    data: usuario
  });

  expect(respuesta.status()).toBe(201);

  const json = await respuesta.json();

  usuarioId = json.data.id;
});

// ============================================
// LIMPIEZA DE REGISTROS TEMPORALES
// ============================================

test.afterAll(async ({ request }) => {
  if (!admin.email || !admin.password) return;

  const headers = await loginAPI(request, admin);

  await eliminarPorNombre(
    request,
    headers,
    'productos',
    nombreProducto
  );

  await eliminarPorNombre(
    request,
    headers,
    'categorias',
    nombreCategoria
  );

  const respuesta = await request.get('/api/usuarios', {
    headers
  });

  expect(respuesta.ok()).toBeTruthy();

  const json = await respuesta.json();

  for (const registro of json.data) {
    if (
      registro.id === usuarioId ||
      registro.email === emailExtra
    ) {
      const eliminado = await request.delete(
        `/api/usuarios/${registro.id}`,
        { headers }
      );

      expect(eliminado.ok()).toBeTruthy();
    }
  }
});

// ============================================
// MODULO 1 - AUTENTICACION
// ============================================

test.describe('Modulo 1 - Autenticacion', () => {

  test('E2E001 - Mostrar formulario de inicio de sesion', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#loginButton')).toBeVisible();
  });

  test('E2E002 - Verificar campo de correo electronico', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#email'))
      .toHaveAttribute('type', 'email');
  });

  test('E2E003 - Ocultar caracteres de la contrasena', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#password'))
      .toHaveAttribute('type', 'password');
  });

  test('E2E004 - Rechazar credenciales incorrectas', async ({ page }) => {
    await page.goto('/');

    await page.locator('#email').fill(admin.email);
    await page.locator('#password').fill('Incorrecta123!');
    await page.locator('#loginButton').click();

    await expect(page.locator('#mensaje'))
      .toContainText(/credenciales|incorrect|inv.lid/i);
  });

  test('E2E005 - Iniciar sesion como administrador', async ({ page }) => {
    await loginUI(page, admin, 'admin');

    await expect(page.locator('main h1'))
      .toContainText(/administraci/i);
  });

  test('E2E006 - Iniciar sesion como usuario normal', async ({ page }) => {
    await loginUI(page, usuario, 'usuario');

    await expect(page.locator('main h1'))
      .toContainText('Panel de usuario');
  });

});

// ============================================
// MODULO 2 - PANEL DE ADMINISTRADOR
// ============================================

test.describe('Modulo 2 - Panel de administrador', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, admin, 'admin');
  });

  test('E2E007 - Mostrar panel de administracion', async ({ page }) => {
    await expect(page.locator('main h1'))
      .toContainText(/administraci/i);
  });

  test('E2E008 - Mostrar resumen general', async ({ page }) => {
    await expect(page.locator('#inicio')).toBeVisible();

    await expect(page.locator('#totalProductos'))
      .toHaveText(/^\d+$/);

    await expect(page.locator('#totalCategorias'))
      .toHaveText(/^\d+$/);
  });

  test('E2E009 - Navegar al modulo Productos', async ({ page }) => {
    await abrirSeccion(page, 'productos');

    await expect(page.locator('#formProducto'))
      .toBeVisible();
  });

  test('E2E010 - Navegar al modulo Categorias', async ({ page }) => {
    await abrirSeccion(page, 'categorias');

    await expect(page.locator('#formCategoria'))
      .toBeVisible();
  });

  test('E2E011 - Navegar al modulo Usuarios', async ({ page }) => {
    await abrirSeccion(page, 'usuarios');

    await expect(page.locator('#formUsuario'))
      .toBeVisible();
  });

  test('E2E012 - Navegar al modulo Sistema', async ({ page }) => {
    await abrirSeccion(page, 'sistema');

    await expect(page.locator('#verificarHealth'))
      .toBeVisible();
  });

});

// ============================================
// MODULO 3 - GESTION DE PRODUCTOS
// ============================================

test.describe('Modulo 3 - Gestion de productos', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, admin, 'admin');
    await abrirSeccion(page, 'productos');
  });

  test('E2E013 - Mostrar formulario de productos', async ({ page }) => {
    await expect(page.locator('#productoNombre'))
      .toBeVisible();

    await expect(page.locator('#productoPrecio'))
      .toBeVisible();

    await expect(page.locator('#productoStock'))
      .toBeVisible();
  });

  test('E2E014 - Validar nombre obligatorio', async ({ page }) => {
    await expect(page.locator('#productoNombre'))
      .toHaveAttribute('required', '');

    const valido = await page.locator('#productoNombre')
      .evaluate(elemento => elemento.checkValidity());

    expect(valido).toBe(false);
  });

  test('E2E015 - Registrar producto desde la interfaz', async ({ page }) => {
    await page.locator('#productoNombre')
      .fill(nombreProducto);

    await page.locator('#productoPrecio')
      .fill('1500');

    await page.locator('#productoStock')
      .fill('20');

    await page.locator('#formProducto button[type="submit"]')
      .click();

    const fila = page.locator('#tablaProductos tr')
      .filter({ hasText: nombreProducto });

    await expect(fila).toBeVisible();
    await expect(fila).toContainText('20');
  });

  test('E2E016 - Eliminar producto desde la interfaz', async ({ page, request }) => {
    const headers = await tokenUI(page);

    const nombre = `${nombreProducto} eliminar`;

    const creado = await request.post('/api/productos', {
      headers,
      data: {
        nombre,
        precio: 100,
        stock: 2
      }
    });

    expect(creado.status()).toBe(201);

    try {
      await page.reload();

      await expect(page.locator('#rolUsuario'))
        .toHaveText(/admin/i);

      await abrirSeccion(page, 'productos');

      const fila = page.locator('#tablaProductos tr')
        .filter({ hasText: nombre });

      await expect(fila).toBeVisible();

      page.once('dialog', dialog => dialog.accept());

      await fila.getByRole('button', {
        name: 'Eliminar',
        exact: true
      }).click();

      await expect(fila).toHaveCount(0);

    } finally {
      await eliminarPorNombre(
        request,
        headers,
        'productos',
        nombre
      );
    }
  });

});

// ============================================
// MODULO 4 - GESTION DE CATEGORIAS
// ============================================

test.describe('Modulo 4 - Gestion de categorias', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, admin, 'admin');
    await abrirSeccion(page, 'categorias');
  });

  test('E2E017 - Mostrar formulario de categorias', async ({ page }) => {
    await expect(page.locator('#formCategoria'))
      .toBeVisible();

    await expect(page.locator('#categoriaNombre'))
      .toBeVisible();
  });

  test('E2E018 - Validar nombre obligatorio de categoria', async ({ page }) => {
    const valido = await page.locator('#categoriaNombre')
      .evaluate(elemento => elemento.checkValidity());

    expect(valido).toBe(false);
  });

  test('E2E019 - Registrar categoria desde la interfaz', async ({ page }) => {
    await page.locator('#categoriaNombre')
      .fill(nombreCategoria);

    await page.locator('#formCategoria button[type="submit"]')
      .click();

    await expect(page.locator('#tablaCategorias'))
      .toContainText(nombreCategoria);
  });

  test('E2E020 - Eliminar categoria desde la interfaz', async ({ page, request }) => {
    const headers = await tokenUI(page);

    const nombre = `${nombreCategoria} eliminar`;

    const creado = await request.post('/api/categorias', {
      headers,
      data: { nombre }
    });

    expect(creado.status()).toBe(201);

    try {
      await page.reload();

      await expect(page.locator('#rolUsuario'))
        .toHaveText(/admin/i);

      await abrirSeccion(page, 'categorias');

      const fila = page.locator('#tablaCategorias tr')
        .filter({ hasText: nombre });

      await expect(fila).toBeVisible();

      page.once('dialog', dialog => dialog.accept());

      await fila.getByRole('button', {
        name: 'Eliminar',
        exact: true
      }).click();

      await expect(fila).toHaveCount(0);

    } finally {
      await eliminarPorNombre(
        request,
        headers,
        'categorias',
        nombre
      );
    }
  });

});

// ============================================
// MODULO 5 - ADMINISTRACION DE USUARIOS
// ============================================

test.describe('Modulo 5 - Administracion de usuarios', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, admin, 'admin');
    await abrirSeccion(page, 'usuarios');
  });

  test('E2E021 - Mostrar formulario de usuarios', async ({ page }) => {
    await expect(page.locator('#usuarioNombre'))
      .toBeVisible();

    await expect(page.locator('#usuarioEmail'))
      .toBeVisible();

    await expect(page.locator('#usuarioPassword'))
      .toBeVisible();

    await expect(page.locator('#usuarioRol'))
      .toBeVisible();
  });

  test('E2E022 - Mostrar administrador en listado', async ({ page }) => {
    await expect(page.locator('#tablaUsuarios'))
      .toContainText(admin.email);
  });

  test('E2E023 - Registrar usuario desde la interfaz', async ({ page }) => {
    await page.locator('#usuarioNombre')
      .fill(nombreUsuarioExtra);

    await page.locator('#usuarioEmail')
      .fill(emailExtra);

    await page.locator('#usuarioPassword')
      .fill(usuario.password);

    await page.locator('#usuarioRol')
      .selectOption('usuario');

    await page.locator('#formUsuario button[type="submit"]')
      .click();

    await expect(page.locator('#tablaUsuarios'))
      .toContainText(emailExtra);
  });

  test('E2E024 - Mostrar roles disponibles', async ({ page }) => {
    const roles = await page.locator('#usuarioRol option')
      .evaluateAll(opciones => opciones.map(o => o.value));

    expect(roles).toContain('admin');
    expect(roles).toContain('usuario');
  });

});

// ============================================
// MODULO 6 - PANEL DE USUARIO NORMAL
// ============================================

test.describe('Modulo 6 - Panel de usuario normal', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, usuario, 'usuario');
  });

  test('E2E025 - Mostrar panel exclusivo de usuario', async ({ page }) => {
    await expect(page.locator('main h1'))
      .toContainText('Panel de usuario');
  });

  test('E2E026 - Consultar resumen de inventario', async ({ page }) => {
    await expect(page.locator('#totalProductos'))
      .toBeVisible();

    await expect(page.locator('#totalCategorias'))
      .toBeVisible();
  });

  test('E2E027 - Consultar productos', async ({ page }) => {
    await abrirSeccion(page, 'productos');

    await expect(page.locator('#productos h2'))
      .toContainText(/consulta/i);

    await expect(page.locator('#tablaProductos'))
      .toBeVisible();
  });

  test('E2E028 - Consultar categorias', async ({ page }) => {
    await abrirSeccion(page, 'categorias');

    await expect(page.locator('#categorias h2'))
      .toContainText(/consulta/i);

    await expect(page.locator('#tablaCategorias'))
      .toBeVisible();
  });

  test('E2E029 - Ocultar registro y eliminacion de productos', async ({ page }) => {
    await abrirSeccion(page, 'productos');

    await expect(page.locator('#formProducto'))
      .toBeHidden();

    await expect(
      page.locator('#productos')
        .getByRole('button', { name: 'Eliminar' })
    ).toHaveCount(0);
  });

  test('E2E030 - Ocultar registro y eliminacion de categorias', async ({ page }) => {
    await abrirSeccion(page, 'categorias');

    await expect(page.locator('#formCategoria'))
      .toBeHidden();

    await expect(
      page.locator('#categorias')
        .getByRole('button', { name: 'Eliminar' })
    ).toHaveCount(0);
  });

});

// ============================================
// MODULO 7 - SEGURIDAD Y ACCESO
// ============================================

test.describe('Modulo 7 - Seguridad y acceso', () => {

  test('E2E031 - Impedir acceso al dashboard sin sesion', async ({ page }) => {
    await page.goto('/dashboard.html');

    await expect(page.locator('#loginForm'))
      .toBeVisible();

    await expect(page).toHaveURL(/\/$/);
  });

  test('E2E032 - Ocultar administracion de usuarios', async ({ page }) => {
    await loginUI(page, usuario, 'usuario');

    await expect(page.locator('[data-section="usuarios"]'))
      .toBeHidden();
  });

  test('E2E033 - Ocultar modulo Sistema al usuario normal', async ({ page }) => {
    await loginUI(page, usuario, 'usuario');

    await expect(page.locator('[data-section="sistema"]'))
      .toBeHidden();
  });

  test('E2E034 - Bloquear API de usuarios para rol normal', async ({ page }) => {
    await loginUI(page, usuario, 'usuario');

    const headers = await tokenUI(page);

    const respuesta = await page.request.get('/api/usuarios', {
      headers
    });

    expect(respuesta.status()).toBe(403);
  });

  test('E2E035 - Cerrar sesion y bloquear dashboard', async ({ page }) => {
    await loginUI(page, admin, 'admin');

    await page.locator('#logout').click();

    await expect(page.locator('#loginForm'))
      .toBeVisible();

    const token = await page.evaluate(() =>
      sessionStorage.getItem('access_token')
    );

    expect(token).toBeNull();

    await page.goto('/dashboard.html');

    await expect(page.locator('#loginForm'))
      .toBeVisible();
  });

});

// ============================================
// MODULO 8 - SISTEMA Y RESPALDO
// ============================================

test.describe('Modulo 8 - Sistema y respaldo', () => {

  test('E2E036 - Verificar endpoint Health', async ({ request }) => {
    const respuesta = await request.get('/api/health');

    expect(respuesta.status()).toBe(200);

    const json = await respuesta.json();

    expect(json.data.estado).toBe('OK');
    expect(json.data.timestamp).toBeTruthy();
  });

  test('E2E037 - Verificar servidor desde la interfaz', async ({ page }) => {
    await loginUI(page, admin, 'admin');

    await abrirSeccion(page, 'sistema');

    await page.locator('#verificarHealth').click();

    await expect(page.locator('#resultadoSistema'))
      .toContainText('"estado": "OK"');
  });

  test('E2E038 - Solicitar respaldo desde la interfaz', async ({ page }) => {
    await loginUI(page, admin, 'admin');

    await abrirSeccion(page, 'sistema');

    await page.locator('#generarBackup').click();

    await expect(page.locator('#resultadoSistema'))
      .toContainText('backup_database.json');

    const contenido = await page.locator('#resultadoSistema')
      .textContent();

    const json = JSON.parse(contenido);

    expect(json.statusCode).toBe(200);
    expect(json.data.tamano_bytes).toBeGreaterThan(0);
  });

});
