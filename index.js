const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const clientesRouter = require('./routes/clientes');
const trabajosRouter = require('./routes/trabajos');

app.use('/clientes', clientesRouter);
app.use('/trabajos', trabajosRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});