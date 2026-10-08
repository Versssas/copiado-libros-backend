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

    // Cuándo se cobró cada trabajo, para Mi Caja. Lo pone la base sola cuando el estado pasa a
    // 'Cobrado' (al crear o al editar) y lo borra si deja de estarlo. Los trabajos que ya estaban
    // cobrados antes de esto quedan sin fecha, así no se importan.
    await pool.query(`ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS cobrado_en TIMESTAMPTZ`);
    await pool.query(`
        CREATE OR REPLACE FUNCTION trabajos_cobrado_en() RETURNS trigger AS $$
        BEGIN
            IF NEW.estado = 'Cobrado' THEN
                IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'Cobrado' THEN
                    NEW.cobrado_en := now();
                ELSE
                    NEW.cobrado_en := OLD.cobrado_en;
                END IF;
            ELSE
                NEW.cobrado_en := NULL;
            END IF;
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    `);
    await pool.query(`
        DROP TRIGGER IF EXISTS trabajos_cobrado_en ON trabajos;
        CREATE TRIGGER trabajos_cobrado_en BEFORE INSERT OR UPDATE ON trabajos
            FOR EACH ROW EXECUTE FUNCTION trabajos_cobrado_en()
    `);
}

module.exports = migrate;
