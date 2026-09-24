const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT c.*, e.nombre AS estudio_contable_nombre
             FROM clientes c
             LEFT JOIN estudios_contables e ON e.id = c.estudio_contable_id
             ORDER BY c.id`
        );
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre, cuit, telefono, condicion_iva, estudio_contable_id } = req.body;

        const cuitLimpio = (cuit || '').replace(/[-\s]/g, '')
        if (cuitLimpio && !/^\d{11}$/.test(cuitLimpio)) {
            return res.status(400).json({ error: 'El CUIT debe tener exactamente 11 dígitos' })
        }

        const existe = await pool.query(
            cuitLimpio
                ? 'SELECT id FROM clientes WHERE LOWER(nombre) = LOWER($1) OR cuit = $2'
                : 'SELECT id FROM clientes WHERE LOWER(nombre) = LOWER($1)',
            cuitLimpio ? [nombre, cuitLimpio] : [nombre]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe un cliente con ese nombre o CUIT' });
        }

        const resultado = await pool.query(
            'INSERT INTO clientes (nombre, cuit, telefono, condicion_iva, estudio_contable_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, cuitLimpio, telefono, condicion_iva || 1, estudio_contable_id || null]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
        res.json({ mensaje: 'Cliente eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, cuit, telefono, condicion_iva, estudio_contable_id } = req.body;

        const cuitLimpio = (cuit || '').replace(/[-\s]/g, '')
        if (cuitLimpio && !/^\d{11}$/.test(cuitLimpio)) {
            return res.status(400).json({ error: 'El CUIT debe tener exactamente 11 dígitos' })
        }

        const resultado = await pool.query(
            'UPDATE clientes SET nombre=$1, cuit=$2, telefono=$3, condicion_iva=$4, estudio_contable_id=$5 WHERE id=$6 RETURNING *',
            [nombre, cuitLimpio, telefono, condicion_iva || 1, estudio_contable_id || null, id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;