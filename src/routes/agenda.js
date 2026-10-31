const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/v1/agenda/turnos-libres
 * Turnos libres a 60 días desde la vista maestra v_n8n_turnos_libres
 */
router.get('/turnos-libres', authenticateToken, async (req, res) => {
  const { profesional, fecha } = req.query;

  let query = `SELECT * FROM public.v_n8n_turnos_libres WHERE 1=1`;
  const values = [];
  let paramIdx = 1;

  if (profesional) {
    query += ` AND id_recurso = $${paramIdx}`;
    values.push(parseInt(profesional, 10));
    paramIdx++;
  }

  if (fecha) {
    query += ` AND fecha = $${paramIdx}::date`;
    values.push(fecha);
    paramIdx++;
  }

  query += ` ORDER BY fecha ASC, hora_inicio ASC`;

  try {
    const result = await db.query(query, values);
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('[AGENDA TURNOS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al consultar turnos disponibles' });
  }
});

/**
 * GET /api/v1/agenda/profesionales
 * Directorio de profesionales asistenciales activos
 */
router.get('/profesionales', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM public.v_n8n_profesionales`);
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('[AGENDA PROFESIONALES ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al consultar profesionales' });
  }
});

/**
 * GET /api/v1/agenda/servicios
 * Catálogo de servicios habilitados
 */
router.get('/servicios', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM public.v_n8n_servicios_habilitados`);
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('[AGENDA SERVICIOS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al consultar servicios' });
  }
});

module.exports = router;

