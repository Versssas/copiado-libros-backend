const pool = require('./db');

async function migrate() {
    await pool.query(`
        ALTER TABLE trabajos
            ADD COLUMN IF NOT EXISTS tipo_factura INTEGER,
            ADD COLUMN IF NOT EXISTS anulada BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS nro_nota_credito VARCHAR
    `);
}

module.exports = migrate;
