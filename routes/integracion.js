const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db');

// Acceso para Mi Caja (ahorratealgo.com.ar), con la clave de MICAJA_API_KEY en el header x-api-key.
// Sin esa variable, la ruta no existe.
const hash = (v) => crypto.createHash('sha256').update(String(v)).digest();
router.use((req, res, next) => {
    const clave = process.env.MICAJA_API_KEY;
    if (!clave) return res.status(404).json({ error: 'No encontrado' });
    if (!crypto.timingSafeEqual(hash(req.headers['x-api-key'] || ''), hash(clave))) {
        return res.status(401).json({ error: 'Clave inválida' });
    }
    next();
});

// Trabajos cobrados desde que existe cobrado_en (los viejos no tienen fecha y no aparecen).
// fecha es el día del cobro en hora argentina; monto es lo que se cobró (con IVA si lleva).
router.get('/cobrados', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT t.id, c.nombre AS cliente, t.hojas,
                   CASE WHEN t.iva THEN COALESCE(t.total_con_iva, t.total) ELSE t.total END AS monto,
                   to_char(t.cobrado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha
            FROM trabajos t
            LEFT JOIN clientes c ON c.id = t.cliente_id
            WHERE t.estado = 'Cobrado' AND t.cobrado_en IS NOT NULL
            ORDER BY t.cobrado_en
        `);
        res.json({ trabajos: resultado.rows });
    } catch (error) {
        console.error('Error en /integracion/cobrados:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;
