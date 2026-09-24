const pool = require('./db');

async function migrate() {
    await pool.query(`
        ALTER TABLE trabajos
            ADD COLUMN IF NOT EXISTS tipo_factura INTEGER,
            ADD COLUMN IF NOT EXISTS anulada BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS nro_nota_credito VARCHAR
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS estudios_contables (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR NOT NULL UNIQUE
        )
    `);

    await pool.query(`
        ALTER TABLE clientes
            ADD COLUMN IF NOT EXISTS estudio_contable_id INTEGER REFERENCES estudios_contables(id)
    `);

    await pool.query(`
        ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_estudio_contable_id_fkey;
        ALTER TABLE clientes
            ADD CONSTRAINT clientes_estudio_contable_id_fkey
            FOREIGN KEY (estudio_contable_id) REFERENCES estudios_contables(id) ON DELETE SET NULL
    `);
}

module.exports = migrate;
