const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener todos los clientes
router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM clientes ORDER BY id');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Agregar cliente
router.post('/', async (req, res) => {
    try {
        const { nombre, cuit, telefono } = req.body;
        const resultado = await pool.query(
            'INSERT INTO clientes (nombre, cuit, telefono) VALUES ($1, $2, $3) RETURNING *',
            [nombre, cuit, telefono]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar cliente
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
        const { nombre, cuit, telefono } = req.body;
        const resultado = await pool.query(
            'UPDATE clientes SET nombre=$1, cuit=$2, telefono=$3 WHERE id=$4 RETURNING *',
            [nombre, cuit, telefono, id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;