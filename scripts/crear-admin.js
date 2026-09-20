/* eslint-disable no-console */
require('dotenv').config();
const { hashPassword } = require('../src/utils/password');
const sequelize = require('../src/config/database');
const { Usuario } = require('../src/models');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || 'admin@horus.local').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!password || password.length < 10) {
    console.error('Define ADMIN_EMAIL y ADMIN_PASSWORD (>=10 caracteres) en el entorno para crear el admin.');
    process.exitCode = 1;
    return;
  }
  await sequelize.authenticate();
  const existente = await Usuario.findOne({ where: { email } });
  const password_hash = hashPassword(password);
  if (existente) {
    await existente.update({ password_hash, rol: 'admin', activo: true });
    console.log(`Admin actualizado: ${email}`);
  } else {
    await Usuario.create({
      nombres: 'Admin', apellidos: 'Horus', email, password_hash,
      rol: 'admin', activo: true,
    });
    console.log(`Admin creado: ${email}`);
  }
  process.exitCode = 0;
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
