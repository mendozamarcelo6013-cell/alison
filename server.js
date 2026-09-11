require('dotenv').config();

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
    console.error('No se pudo conectar a MySQL. Revisa XAMPP y las variables de .env.');
    console.error(error.message);
    process.exitCode = 1;
  }
}

iniciarServidor();
