const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
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