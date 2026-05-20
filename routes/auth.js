const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Usuario hardcodeado por ahora
const USUARIO = 'Walter';
const PASSWORD_HASH = bcrypt.hashSync('0161', 10);

router.post('/login', async (req, res) => {
    const { usuario, password } = req.body;

    if (usuario !== USUARIO) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const passwordValida = await bcrypt.compare(password, PASSWORD_HASH);
    if (!passwordValida) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ usuario }, process.env.JWT_SECRET || 'secreto123', { expiresIn: '8h' });
    res.json({ token });
});

module.exports = router;