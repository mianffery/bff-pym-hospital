const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/v1/demanda
 * Listado de demanda inducida PyM con semáforos y filtros
 */
router.get('/', authenticateToken, async (req, res) => {
  const {
    curso,
    semaforo,
    programa,
    discapacidad,
    filtro = '',
    limit = 50,
    offset = 0,
  } = req.query;

  const parsedLimit = parseInt(limit, 10);
  const parsedOffset = parseInt(offset, 10);

  let query = `
    SELECT 
      d."ID_Usuario"::text AS id,
      d."Nombre_y_apellido" AS nombre,
      COALESCE(g."Telefono", 'Sin teléfono') AS telefono,
      d."Edad" AS edad_texto,
      d."Programa" AS programa,
      d."Tipo_de_Discapacidad" AS discapacidad,
      d."Clasificacion_Nutricional" AS nutricional,
      d."Alerta_Salud" AS alerta_salud,
      d."Atenciones_Pendientes" AS atenciones_pendientes,
      d."Atenciones_Al_Dia" AS atenciones_al_dia,
      d."Atenciones_Totales" AS atenciones_totales,
      d."Atenciones_No_Cumplidas" AS atenciones_no_cumplidas,
      g."Curso_de_Vida" AS curso_vida,
      g."EAPB" AS eapb,
      g."Microterritorio" AS microterritorio,
      g."Estado" AS estado
    FROM public."DEMANDA_DB" d
    LEFT JOIN public."DATOS_GENERALES" g ON d."ID_Usuario"::text = g."ID_Usuario"::text
    WHERE 1=1
  `;

  const values = [];
  let paramIdx = 1;

  if (curso) {
    query += ` AND g."Curso_de_Vida" = $${paramIdx}`;
    values.push(curso);
    paramIdx++;
  }

  if (semaforo) {
    query += ` AND d."Alerta_Salud" = $${paramIdx}`;
    values.push(semaforo);
    paramIdx++;
  }

  if (programa) {
    query += ` AND d."Programa" = $${paramIdx}`;
    values.push(programa);
    paramIdx++;
  }

  if (discapacidad) {
    query += ` AND d."Tipo_de_Discapacidad" = $${paramIdx}`;
    values.push(discapacidad);
    paramIdx++;
  }

  if (filtro && filtro.trim().length > 0) {
    query += ` AND (d."ID_Usuario"::text ILIKE $${paramIdx} OR unaccent(d."Nombre_y_apellido") ILIKE unaccent($${paramIdx}))`;
    values.push(`%${filtro.trim()}%`);
    paramIdx++;
  }

  query += ` ORDER BY d."Nombre_y_apellido" ASC`;

  if (parsedLimit > 0) {
    query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    values.push(parsedLimit, parsedOffset >= 0 ? parsedOffset : 0);
  }

  try {
    const result = await db.query(query, values);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('[DEMANDA QUERY ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al consultar demanda PyM' });
  }
});

/**
 * GET /api/v1/demanda/resumen-alertas
 * Consolidado epidemiológico desde vista maestra v_demanda_resumen_alertas
 */
router.get('/resumen-alertas', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM public.v_demanda_resumen_alertas`);
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('[RESUMEN ALERTAS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al consultar resumen epidemiológico' });
  }
});

module.exports = router;

