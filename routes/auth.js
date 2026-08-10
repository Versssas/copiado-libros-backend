const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const USUARIO = process.env.AUTH_USUARIO;
const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos, intentá de nuevo más tarde' }
});

router.post('/login', loginLimiter, async (req, res) => {
    const { usuario, password } = req.body;

    if (usuario !== USUARIO) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const passwordValida = await bcrypt.compare(password, PASSWORD_HASH);
    if (!passwordValida) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ usuario }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
});

module.exports = router;