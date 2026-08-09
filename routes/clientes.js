const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM clientes ORDER BY id');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre, cuit, telefono, condicion_iva } = req.body;
        
        const cuitLimpio = cuit.replace(/[-\s]/g, '')
        if (!/^\d{11}$/.test(cuitLimpio)) {
            return res.status(400).json({ error: 'El CUIT debe tener exactamente 11 dígitos' })
        }

        const existe = await pool.query(
            'SELECT id FROM clientes WHERE LOWER(nombre) = LOWER($1) OR cuit = $2',
            [nombre, cuitLimpio]
        );
        
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe un cliente con ese nombre o CUIT' });
        }
        
        const resultado = await pool.query(
            'INSERT INTO clientes (nombre, cuit, telefono, condicion_iva) VALUES ($1, $2, $3, $4) RETURNING *',
            [nombre, cuitLimpio, telefono, condicion_iva || 1]
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
        const { nombre, cuit, telefono, condicion_iva } = req.body;

        const cuitLimpio = cuit.replace(/[-\s]/g, '')
        if (!/^\d{11}$/.test(cuitLimpio)) {
            return res.status(400).json({ error: 'El CUIT debe tener exactamente 11 dígitos' })
        }

        const resultado = await pool.query(
            'UPDATE clientes SET nombre=$1, cuit=$2, telefono=$3, condicion_iva=$4 WHERE id=$5 RETURNING *',
            [nombre, cuitLimpio, telefono, condicion_iva || 1, id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;