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

// Migración única: extrae el estudio contable entre paréntesis del nombre
// de cada cliente, lo unifica con variantes/typos conocidas, crea el
// estudio si no existe, limpia el nombre del cliente y linkea el estudio.
// TODO: borrar esta ruta una vez ejecutada en producción.
const CANONICO = {
    'PANDOLFINI': 'OTEGUI PANDOLFINI',
    'OTEGUI': 'OTEGUI PANDOLFINI',
    'ALE LENAR': 'ALE LENARD',
};

router.post('/_migrar_estudios', async (req, res) => {
    const cambios = [];
    try {
        const clientes = await pool.query('SELECT id, nombre FROM clientes');

        for (const c of clientes.rows) {
            const match = c.nombre.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
            if (!match) continue;

            const nombreLimpio = match[1].trim();
            const estudioRaw = match[2].trim();
            const estudioNombre = CANONICO[estudioRaw] || estudioRaw;

            let estudio = await pool.query('SELECT id FROM estudios_contables WHERE nombre = $1', [estudioNombre]);
            let estudioId;
            if (estudio.rows.length > 0) {
                estudioId = estudio.rows[0].id;
            } else {
                const nuevo = await pool.query('INSERT INTO estudios_contables (nombre) VALUES ($1) RETURNING id', [estudioNombre]);
                estudioId = nuevo.rows[0].id;
            }

            await pool.query(
                'UPDATE clientes SET nombre = $1, estudio_contable_id = $2 WHERE id = $3',
                [nombreLimpio, estudioId, c.id]
            );

            cambios.push({ id: c.id, antes: c.nombre, nombre: nombreLimpio, estudio: estudioNombre });
        }

        res.json({ migrados: cambios.length, cambios });
    } catch (error) {
        res.status(500).json({ error: error.message, cambios });
    }
});

module.exports = router;