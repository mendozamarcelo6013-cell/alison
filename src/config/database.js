const { Sequelize } = require('sequelize');
require('dotenv').config();

const usaSsl = process.env.DB_SSL === 'true';

const configuracion = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  pool: {
    max: Number(process.env.DB_POOL_MAX || 5),
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

if (usaSsl) {
  configuracion.dialectOptions = {
    ssl: {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    },
  };
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'horus_market_dev',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || null,
  configuracion,
);

module.exports = sequelize;
