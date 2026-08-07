const express = require('express');
const router = express.Router();
const soap = require('soap');
const { getToken, CUIT, WSFE_URL } = require('../afip');
const pool = require('../db');

router.post('/emitir', async (req, res) => {
    try {
        const { trabajo_id, tipo_factura } = req.body;
        // tipo_factura: 1=A, 6=B, 11=C

        // Obtener trabajo
        const trabajo = await pool.query(
            'SELECT t.*, c.nombre as cliente_nombre, c.cuit as cliente_cuit FROM trabajos t JOIN clientes c ON t.cliente_id = c.id WHERE t.id = $1',
            [trabajo_id]
        );

        if (trabajo.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajo no encontrado' });
        }

        const t = trabajo.rows[0];

        // Obtener token de ARCA
        const { token, sign } = await getToken();

        // Conectar al WSFE
        const client = await soap.createClientAsync(WSFE_URL);

        // Obtener último número de comprobante
        const ultimoResult = await client.FECompUltimoAutorizadoAsync({
            Auth: { Token: token, Sign: sign, Cuit: CUIT },
            PtoVta: 1,
            CbteTipo: tipo_factura
        });

        const ultimoNro = ultimoResult[0].FECompUltimoAutorizadoResult.CbteNro;
        const nuevoNro = ultimoNro + 1;

        const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const total = t.iva ? Number(t.total_con_iva) : Number(t.total);
        const neto = t.iva ? Number(t.total) : total;
        const iva = t.iva ? total - neto : 0;

        // Emitir factura
        const result = await client.FECAESolicitudAsync({
            Auth: { Token: token, Sign: sign, Cuit: CUIT },
            FeCAEReq: {
                FeCabReq: {
                    CantReg: 1,
                    PtoVta: 1,
                    CbteTipo: tipo_factura
                },
                FeDetReq: {
                    FECAEDetRequest: {
                        Concepto: 1,
                        DocTipo: 80,
                        DocNro: t.cliente_cuit,
                        CbteDesde: nuevoNro,
                        CbteHasta: nuevoNro,
                        CbteFch: fecha,
                        ImpTotal: total,
                        ImpTotConc: 0,
                        ImpNeto: neto,
                        ImpOpEx: 0,
                        ImpIVA: iva,
                        ImpTrib: 0,
                        MonId: 'PES',
                        MonCotiz: 1,
                        Iva: t.iva ? {
                            AlicIva: {
                                Id: 5,
                                BaseImp: neto,
                                Importe: iva
                            }
                        } : undefined
                    }
                }
            }
        });

        const det = result[0].FECAESolicitudResult.FeDetResp.FECAEDetResponse;
        
        if (det.Resultado === 'A') {
            // Guardar CAE en la base de datos
            await pool.query(
                'UPDATE trabajos SET nro_factura = $1 WHERE id = $2',
                [`${nuevoNro}`, trabajo_id]
            );

            res.json({
                exito: true,
                cae: det.CAE,
                vencimiento: det.CAEFchVto,
                nro_comprobante: nuevoNro
            });
        } else {
            res.status(400).json({ error: 'ARCA rechazó la factura', obs: det.Observaciones });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;