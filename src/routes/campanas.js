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
      `SELECT "ID_Usuario"::text AS id, 
              COALESCE("Nombre_y_apellido", concat_ws(' ', "Primer_Nombre", "Segundo_Nombre", "Primer_Apellido", "Segundo_Apellido")) AS nombre, 
              "Telefono" AS telefono
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

          // Formateo institucional con saludo y emojis oficiales
          const captionInstitucional = mensajePersonalizado.toLowerCase().includes('perpetuo socorro')
            ? mensajePersonalizado
            : `🙋‍♀️ Hola *${p.nombre || 'Usuario'}*,\n\n🏥 La *ESE Hospital del Perpetuo Socorro* informa que:\n${mensajePersonalizado} 🚑`;

          const bannerHospital = 'https://lh3.googleusercontent.com/d/1364oN9l3MAcl-b0F7abm0b_MoBnvAI3F';
          const payloadMedia = {
            number: numeroE164,
            mediatype: 'image',
            mimetype: 'image/png',
            fileName: 'comunicado_hospital.png',
            media: bannerHospital,
            caption: captionInstitucional,
          };

          await client.query(
            `INSERT INTO public."COLA_MENSAJES_WA" (
              "endpoint", 
              "payload", 
              "prioridad", 
              "estado", 
              "metadata",
              "numero_destino", 
              "tipo_mensaje", 
              "contenido_texto"
            ) VALUES (
              'sendMedia', 
              $1::jsonb, 
              2, 
              'Pendiente', 
              $2::jsonb,
              $3, 
              'imagen', 
              $4
            )`,
            [
              JSON.stringify(payloadMedia),
              JSON.stringify({ origen: 'CAMPANA', id_usuario: p.id, responsable: req.user?.nombre || req.user?.usuario || 'Administrador Maestro' }),
              numeroE164,
              captionInstitucional
            ]
          );
          encolados++;
        }
      }

      // Registro de auditoría institucional
      await client.query(
        `INSERT INTO public."AUDITORIA_SISTEMA" ("usuario_app", "modulo", "accion_realizada")
         VALUES ($1, 'Campañas BFF', $2)`,
        [req.user?.nombre || req.user?.usuario || 'Sistema', `Encoló campaña masiva a ${encolados} pacientes (Prioridad 2)`]
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
    res.status(500).json({ success: false, error: 'Error al encolar campaña masiva', detalle: err.message });
  }
});

module.exports = router;
