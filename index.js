const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

for (const v of ['JWT_SECRET', 'AUTH_USUARIO', 'AUTH_PASSWORD_HASH']) {
    if (!process.env[v]) {
        console.error(`Falta la variable de entorno requerida: ${v}`);
        process.exit(1);
    }
}

const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const app = express();
app.use(cors({ origin: corsOrigins.length ? corsOrigins : false }));
app.use(express.json());

const verificarToken = require('./middleware/auth');
const authRouter = require('./routes/auth');
const clientesRouter = require('./routes/clientes');
const trabajosRouter = require('./routes/trabajos');
const facturasRouter = require('./routes/facturas');
const migrate = require('./migrate');

app.use('/facturas', verificarToken, facturasRouter);
app.use('/auth', authRouter);
app.use('/clientes', verificarToken, clientesRouter);
app.use('/trabajos', verificarToken, trabajosRouter);

const PORT = process.env.PORT || 3000;

migrate()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en puerto ${PORT}`);
        });
    })
    .catch(error => {
        console.error('Error al migrar la base de datos:', error);
        process.exit(1);
    });