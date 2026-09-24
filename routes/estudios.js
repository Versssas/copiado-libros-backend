const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM estudios_contables ORDER BY nombre');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del estudio es obligatorio' });
        }
        const resultado = await pool.query(
            'INSERT INTO estudios_contables (nombre) VALUES ($1) RETURNING *',
            [nombre.trim()]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un estudio con ese nombre' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del estudio es obligatorio' });
        }
        const resultado = await pool.query(
            'UPDATE estudios_contables SET nombre = $1 WHERE id = $2 RETURNING *',
            [nombre.trim(), id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un estudio con ese nombre' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM estudios_contables WHERE id = $1', [id]);
        res.json({ mensaje: 'Estudio eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
