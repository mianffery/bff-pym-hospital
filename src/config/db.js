const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'ep-calm-resonance-ax86e36z.c-4.us-east-2.aws.neon.tech',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'neondb',
  user: process.env.DB_USER || 'neondb_owner',
  password: process.env.DB_PASS || 'npg_wTbjhim3aKt0',
  ssl: process.env.DB_SSL === 'false' ? false : {
    rejectUnauthorized: false,
  },
  max: 20, // Concurrencia máxima en pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR]: Error inesperado en el cliente inactivo de PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

