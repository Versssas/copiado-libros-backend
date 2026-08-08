const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener todos los trabajos
router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT t.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.cuit as cliente_cuit
            FROM trabajos t 
            JOIN clientes c ON t.cliente_id = c.id 
            ORDER BY t.id
        `);
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Agregar trabajo
router.post('/', async (req, res) => {
    try {
        const { cliente_id, fecha, fecha_entrega, hojas, precio_hoja, total, estado, iva, total_con_iva, nro_factura } = req.body;
        const resultado = await pool.query(
            'INSERT INTO trabajos (cliente_id, fecha, fecha_entrega, hojas, precio_hoja, total, estado, iva, total_con_iva, nro_factura) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [cliente_id, fecha, fecha_entrega, hojas, precio_hoja, total, estado, iva, total_con_iva, nro_factura]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Código de error para violación de restricción única
            res.status(400).json({ error: 'El número de factura ya existe' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});
// Editar trabajo
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { cliente_id, fecha, fecha_entrega, hojas, precio_hoja, total, estado, iva, total_con_iva, nro_factura } = req.body;
        const resultado = await pool.query(
            'UPDATE trabajos SET cliente_id=$1, fecha=$2, fecha_entrega=$3, hojas=$4, precio_hoja=$5, total=$6, estado=$7, iva=$8, total_con_iva=$9, nro_factura=$10 WHERE id=$11 RETURNING *',
            [cliente_id, fecha, fecha_entrega, hojas, precio_hoja, total, estado, iva, total_con_iva, nro_factura, id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Código de error para violación de restricción única
            res.status(400).json({ error: 'El número de factura ya existe' });
        } else {   
        res.status(500).json({ error: error.message });
        }
    }
});

// Eliminar trabajo
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM trabajos WHERE id = $1', [id]);
        res.json({ mensaje: 'Trabajo eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;