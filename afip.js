const soap = require('soap');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
crypto.setFips(0);
const WSAA_URL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl';
const WSFE_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL';

const KEY = process.env.AFIP_KEY?.replace(/\\n/g, '\n');
const CERT = process.env.AFIP_CERT?.replace(/\\n/g, '\n');
const CUIT = process.env.AFIP_CUIT;

async function getToken() {
    const now = new Date();
    const expire = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const tra = `<?xml version="1.0" encoding="UTF-8"?>
    <loginTicketRequest version="1.0">
        <header>
            <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
            <generationTime>${now.toISOString()}</generationTime>
            <expirationTime>${expire.toISOString()}</expirationTime>
        </header>
        <service>wsfe</service>
    </loginTicketRequest>`;

    const sign = crypto.createSign('SHA256');
    sign.update(tra);
    const signature = sign.sign({
    key: KEY,
    format: 'pem',
    type: 'pkcs1'
}, 'base64');

    const cms = Buffer.from(tra).toString('base64');

    const client = await soap.createClientAsync(WSAA_URL);
    const result = await client.loginCmsAsync({ in0: cms });
    
    const response = result[0].loginCmsReturn;
    const token = response.match(/<token>(.*?)<\/token>/)[1];
    const sign2 = response.match(/<sign>(.*?)<\/sign>/)[1];
    
    return { token, sign: sign2 };
}

module.exports = { getToken, CUIT, WSFE_URL };