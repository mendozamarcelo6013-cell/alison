require('dotenv').config();

const { exigirSecretoArranque } = require('./src/utils/token');

try {
  exigirSecretoArranque();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  return;
}

const app = require('./src/app');
const sequelize = require('./src/config/database');

const port = Number(process.env.PORT || 3000);

async function iniciarServidor() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a MySQL verificada.');

    app.listen(port, () => {
      console.log(`Horus Market API disponible en http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error('No se pudo conectar a MySQL. Revisa las variables de entorno y el acceso al proveedor de base de datos.');
    console.error(error.message);
    process.exitCode = 1;
  }
}

iniciarServidor();
