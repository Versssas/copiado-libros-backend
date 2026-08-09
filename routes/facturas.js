const express = require('express');
const router = express.Router();
const soap = require('soap');
const { getToken, CUIT, WSFE_URL } = require('../afip');
const pool = require('../db');

router.post('/emitir', async (req, res) => {
    try {
        const { trabajo_id, tipo_factura } = req.body;

        const trabajo = await pool.query(
            'SELECT t.*, c.nombre as cliente_nombre, c.cuit as cliente_cuit, c.condicion_iva FROM trabajos t JOIN clientes c ON t.cliente_id = c.id WHERE t.id = $1',
            [trabajo_id]
        );

        if (trabajo.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajo no encontrado' });
        }

        const t = trabajo.rows[0];
        const docNro = parseInt(t.cliente_cuit.replace(/[-\s]/g, ''));

        const { token, sign } = await getToken();
        const client = await soap.createClientAsync(WSFE_URL);

        const ultimoResult = await client.FECompUltimoAutorizadoAsync({
            Auth: { Token: token, Sign: sign, Cuit: CUIT },
            PtoVta: 5,
            CbteTipo: tipo_factura
        });

        const ultimoNro = ultimoResult[0].FECompUltimoAutorizadoResult.CbteNro;
        const nuevoNro = ultimoNro + 1;

        const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const total = t.iva ? Number(t.total_con_iva) : Number(t.total);
        const neto = t.iva ? Number(t.total) : total;
        const iva = t.iva ? total - neto : 0;

        const result = await client.FECAESolicitarAsync({
            Auth: { Token: token, Sign: sign, Cuit: CUIT },
            FeCAEReq: {
                FeCabReq: {
                    CantReg: 1,
                    PtoVta: 5,
                    CbteTipo: tipo_factura
                },
                FeDetReq: {
                    FECAEDetRequest: {
                        Concepto: 1,
                        DocTipo: 80,
                        DocNro: docNro,
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
                        CondicionIVAReceptorId: t.condicion_iva || 1,
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

        console.log('Respuesta WSFE:', JSON.stringify(result[0], null, 2));
        const det = result[0].FECAESolicitarResult.FeDetResp.FECAEDetResponse[0];

        if (det.Resultado === 'A') {
            await pool.query(
                'UPDATE trabajos SET nro_factura = $1, tipo_factura = $2 WHERE id = $3',
                [`${nuevoNro}`, tipo_factura, trabajo_id]
            );

            res.json({
                exito: true,
                cae: det.CAE,
                vencimiento: det.CAEFchVto,
                nro_comprobante: nuevoNro
            });
        } else {
            res.status(400).json({ 
                error: 'ARCA rechazó la factura', 
                obs: det.Observaciones 
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/anular', async (req, res) => {
    try {
        const { trabajo_id } = req.body;

        const trabajo = await pool.query(
            'SELECT t.*, c.nombre as cliente_nombre, c.cuit as cliente_cuit, c.condicion_iva FROM trabajos t JOIN clientes c ON t.cliente_id = c.id WHERE t.id = $1',
            [trabajo_id]
        );

        if (trabajo.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajo no encontrado' });
        }

        const t = trabajo.rows[0];

        if (!t.nro_factura || !t.tipo_factura) {
            return res.status(400).json({ error: 'El trabajo no tiene una factura emitida' });
        }
        if (t.anulada) {
            return res.status(400).json({ error: 'La factura ya fue anulada' });
        }

        const docNro = parseInt(t.cliente_cuit.replace(/[-\s]/g, ''));
        const tipoFactura = t.tipo_factura;
        const nroOriginal = parseInt(t.nro_factura);

        const { token, sign } = await getToken();
        const client = await soap.createClientAsync(WSFE_URL);

        // Tipo nota de crédito: A=3, B=8, C=13
        const tipoNC = tipoFactura === 1 ? 3 : tipoFactura === 6 ? 8 : 13

        const ultimoResult = await client.FECompUltimoAutorizadoAsync({
            Auth: { Token: token, Sign: sign, Cuit: CUIT },
            PtoVta: 5,
            CbteTipo: tipoNC
        });

        const ultimoNro = ultimoResult[0].FECompUltimoAutorizadoResult.CbteNro;
        const nuevoNro = ultimoNro + 1;

        const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const total = t.iva ? Number(t.total_con_iva) : Number(t.total);
        const neto = Number(t.total);
        const iva = t.iva ? total - neto : 0;

        const result = await client.FECAESolicitarAsync({
            Auth: { Token: token, Sign: sign, Cuit: CUIT },
            FeCAEReq: {
                FeCabReq: {
                    CantReg: 1,
                    PtoVta: 5,
                    CbteTipo: tipoNC
                },
                FeDetReq: {
                    FECAEDetRequest: {
                        Concepto: 1,
                        DocTipo: 80,
                        DocNro: docNro,
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
                        CondicionIVAReceptorId: t.condicion_iva || 1,
                        CbtesAsoc: {
                            CbteAsoc: {
                                Tipo: tipoFactura,
                                PtoVta: 5,
                                Nro: nroOriginal,
                                Cuit: CUIT
                            }
                        },
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

        const det = result[0].FECAESolicitarResult.FeDetResp.FECAEDetResponse[0];

        if (det.Resultado === 'A') {
            await pool.query(
                'UPDATE trabajos SET anulada = true, nro_nota_credito = $1 WHERE id = $2',
                [`${nuevoNro}`, trabajo_id]
            );

            res.json({
                exito: true,
                cae: det.CAE,
                vencimiento: det.CAEFchVto,
                nro_comprobante: nuevoNro,
                tipo_factura: tipoFactura,
                nro_factura_original: nroOriginal
            });
        } else {
            res.status(400).json({ error: 'ARCA rechazó la nota de crédito', obs: det.Observaciones });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;