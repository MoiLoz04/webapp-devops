
const form = document.getElementById('loginForm');
const mensaje = document.getElementById('mensaje');
const boton = document.getElementById('loginButton');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  mensaje.textContent = '';
  boton.disabled = true;
  boton.textContent = 'Verificando...';

  try {
    const respuesta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value
      })
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        resultado.message || 'No fue posible iniciar sesión'
      );
    }

    if (!resultado.data?.access_token) {
      throw new Error('No se recibió un token de acceso');
    }

    sessionStorage.setItem(
      'access_token',
      resultado.data.access_token
    );

    window.location.replace('/dashboard.html');

  } catch (error) {
    mensaje.className = 'error';
    mensaje.textContent = error.message;

  } finally {
    boton.disabled = false;
    boton.textContent = 'Iniciar sesión';
  }
});
