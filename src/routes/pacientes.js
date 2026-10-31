const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/v1/pacientes
 * Búsqueda paginada y filtrada de pacientes en DATOS_GENERALES
 */
router.get('/', authenticateToken, async (req, res) => {
  const {
    filtro = '',
    limit = 50,
    offset = 0,
    genero,
    estado,
    eapb,
    micro,
    zona,
  } = req.query;

  const parsedLimit = parseInt(limit, 10);
  const parsedOffset = parseInt(offset, 10);

  let query = `
    SELECT 
      "ID_Usuario"::text AS id,
      "Nombre_y_apellido" AS nombre,
      "Telefono" AS telefono,
      "Direccion" AS direccion,
      "Genero" AS genero,
      "Fecha_Nacimiento"::text AS fecha_nac,
      "Primer_Nombre" AS p_nombre,
      "Segundo_Nombre" AS s_nombre,
      "Primer_Apellido" AS p_apellido,
      "Segundo_Apellido" AS s_apellido,
      "Estado" AS estado,
      "EAPB" AS eapb,
      "Zona" AS zona,
      "Microterritorio" AS microterritorio,
      "Curso_de_Vida" AS curso_vida,
      "Anos" AS anos,
      COALESCE("Programa", 'Ninguno') AS programa
    FROM public."DATOS_GENERALES"
    WHERE 1=1
  `;

  const values = [];
  let paramIdx = 1;

  if (filtro && filtro.trim().length > 0) {
    query += ` AND ("ID_Usuario"::text ILIKE $${paramIdx} OR unaccent("Nombre_y_apellido") ILIKE unaccent($${paramIdx}))`;
    values.push(`%${filtro.trim()}%`);
    paramIdx++;
  }

  if (genero) {
    query += ` AND "Genero" = $${paramIdx}`;
    values.push(genero);
    paramIdx++;
  }

  if (estado) {
    query += ` AND "Estado" = $${paramIdx}`;
    values.push(estado);
    paramIdx++;
  }

  if (eapb) {
    query += ` AND "EAPB" = $${paramIdx}`;
    values.push(eapb);
    paramIdx++;
  }

  if (micro) {
    query += ` AND "Microterritorio" = $${paramIdx}`;
    values.push(micro);
    paramIdx++;
  }

  if (zona) {
    query += ` AND "Zona" = $${paramIdx}`;
    values.push(zona);
    paramIdx++;
  }

  query += ` ORDER BY "Primer_Nombre" ASC`;

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
    console.error('[PACIENTES QUERY ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al consultar pacientes' });
  }
});

/**
 * GET /api/v1/pacientes/count
 * Conteo total según filtros
 */
router.get('/count', authenticateToken, async (req, res) => {
  const { filtro = '', genero, estado, eapb, micro, zona } = req.query;

  let query = `SELECT COUNT(*)::int AS total FROM public."DATOS_GENERALES" WHERE 1=1`;
  const values = [];
  let paramIdx = 1;

  if (filtro && filtro.trim().length > 0) {
    query += ` AND ("ID_Usuario"::text ILIKE $${paramIdx} OR unaccent("Nombre_y_apellido") ILIKE unaccent($${paramIdx}))`;
    values.push(`%${filtro.trim()}%`);
    paramIdx++;
  }

  if (genero) {
    query += ` AND "Genero" = $${paramIdx}`;
    values.push(genero);
    paramIdx++;
  }

  if (estado) {
    query += ` AND "Estado" = $${paramIdx}`;
    values.push(estado);
    paramIdx++;
  }

  if (eapb) {
    query += ` AND "EAPB" = $${paramIdx}`;
    values.push(eapb);
    paramIdx++;
  }

  if (micro) {
    query += ` AND "Microterritorio" = $${paramIdx}`;
    values.push(micro);
    paramIdx++;
  }

  if (zona) {
    query += ` AND "Zona" = $${paramIdx}`;
    values.push(zona);
    paramIdx++;
  }

  try {
    const result = await db.query(query, values);
    res.json({
      success: true,
      total: result.rows[0].total,
    });
  } catch (err) {
    console.error('[PACIENTES COUNT ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al contar pacientes' });
  }
});

/**
 * PUT /api/v1/pacientes/:id
 * Actualización demográfica y de contacto (Habeas Data)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { telefono, direccion, estado, eapb, zona, micro, programa } = req.body;

  try {
    await db.query(
      `UPDATE public."DATOS_GENERALES"
       SET "Telefono" = COALESCE($1, "Telefono"),
           "Direccion" = COALESCE($2, "Direccion"),
           "Estado" = COALESCE($3, "Estado"),
           "EAPB" = COALESCE($4, "EAPB"),
           "Zona" = COALESCE($5, "Zona"),
           "Microterritorio" = COALESCE($6, "Microterritorio"),
           "Programa" = COALESCE($7, "Programa")
       WHERE "ID_Usuario"::text = $8`,
      [telefono, direccion, estado, eapb, zona, micro, programa, id]
    );

    // Auditoría
    db.query(
      `INSERT INTO public."AUDITORIA_SISTEMA" ("usuario_app", "modulo", "accion_realizada")
       VALUES ($1, 'Pacientes BFF', $2)`,
      [req.user.nombre, `Actualizó datos del paciente Doc: ${id}`]
    ).catch(() => {});

    res.json({ success: true, message: 'Paciente actualizado correctamente' });
  } catch (err) {
    console.error('[UPDATE PACIENTE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar paciente' });
  }
});

module.exports = router;

