const soap = require('soap');
const forge = require('node-forge');

const WSAA_URL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl';
const WSFE_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL';

const CERT = process.env.AFIP_CERT?.replace(/\\n/g, '\n');
const KEY = process.env.AFIP_KEY?.replace(/\\n/g, '\n');
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

    const privateKey = forge.pki.privateKeyFromPem(KEY);
    const cert = forge.pki.certificateFromPem(CERT);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
        key: privateKey,
        certificate: cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: []
    });
    p7.sign({ detached: false });

    const cms = forge.util.encode64(
        forge.asn1.toDer(p7.toAsn1()).getBytes()
    );

    const client = await soap.createClientAsync(WSAA_URL);
    const result = await client.loginCmsAsync({ in0: cms });
    
    const response = result[0].loginCmsReturn;
    const token = response.match(/<token>(.*?)<\/token>/)[1];
    const sign = response.match(/<sign>(.*?)<\/sign>/)[1];
    
    return { token, sign };
}

module.exports = { getToken, CUIT, WSFE_URL };