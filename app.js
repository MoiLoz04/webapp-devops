const express = require('express');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});

app.use('/api', require('./src/routes'));

// Iniciar servidor TCP Socket en puerto 6061
require('./src/socket');

const PORT = 8080;
app.listen(PORT, () => {
  console.log('Servidor corriendo en http://localhost:' + PORT);
});     