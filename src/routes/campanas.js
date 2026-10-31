const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/v1/campanas/disparar
 * Encola una campaña masiva de WhatsApp en COLA_MENSAJES_WA (Outbox Pattern, Prioridad 2)
 */
router.post('/disparar', authenticateToken, async (req, res) => {
  const { mensaje, documentos } = req.body;

  if (!mensaje || !Array.isArray(documentos) || documentos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere el mensaje de la campaña y una lista no vacía de documentos',
    });
  }

  try {
    // 1. Obtener teléfonos limpios de los pacientes seleccionados
    const pacientesRes = await db.query(
      `SELECT "ID_Usuario"::text AS id, "Nombre_y_apellido" AS nombre, "Telefono" AS telefono
       FROM public."DATOS_GENERALES"
       WHERE "ID_Usuario"::text = ANY($1::text[])`,
      [documentos]
    );

    let encolados = 0;
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      for (const p of pacientesRes.rows) {
        const telLimpio = (p.telefono || '').replace(/\D/g, '');
        // Solo celulares colombianos válidos (10 dígitos iniciados por 3)
        if (telLimpio.length === 10 && telLimpio.startsWith('3')) {
          const numeroE164 = `57${telLimpio}`;
          const mensajePersonalizado = mensaje
            .replace(/{nombre}/gi, p.nombre || 'Usuario')
            .replace(/{documento}/gi, p.id);

          await client.query(
            `INSERT INTO public."COLA_MENSAJES_WA" (
              "numero_destino", 
              "tipo_mensaje", 
              "contenido_texto", 
              "prioridad", 
              "estado", 
              "payload"
            ) VALUES ($1, 'texto', $2, 2, 'Pendiente', '{}'::jsonb)`,
            [numeroE164, mensajePersonalizado]
          );
          encolados++;
        }
      }

      // Registro de auditoría institucional
      await client.query(
        `INSERT INTO public."AUDITORIA_SISTEMA" ("usuario_app", "modulo", "accion_realizada")
         VALUES ($1, 'Campañas BFF', $2)`,
        [req.user.nombre, `Encoló campaña masiva a ${encolados} pacientes (Prioridad 2)`]
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      encolados,
      total_solicitados: documentos.length,
      mensaje: `Se encolaron exitosamente ${encolados} mensajes en la cola de salida`,
    });
  } catch (err) {
    console.error('[CAMPANA DISPARAR ERROR]:', err);
    res.status(500).json({ success: false, error: 'Error al encolar campaña masiva' });
  }
});

module.exports = router;

