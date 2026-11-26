
require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));

app.use(express.urlencoded({
  extended: true,
  limit: '50mb'
}));

app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});

// Interfaz grafica
app.use(express.static(path.join(__dirname, 'public')));

// Autenticacion
app.use('/api/auth', require('./src/auth.routes'));

// Administracion de usuarios
app.use('/api/usuarios', require('./src/usuarios'));

// Endpoints originales
app.use('/api', require('./src/routes'));

const PORT = process.env.PORT || 8080;

if (require.main === module) {
  require('./src/socket');

  app.listen(PORT, () => {
    console.log(
      'Servidor corriendo en http://localhost:' + PORT
    );
  });
}

module.exports = app;
