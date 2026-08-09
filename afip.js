const soap = require('soap');
const forge = require('node-forge');

const ES_TESTING = process.env.AFIP_ENV === 'testing';

const WSAA_URL = ES_TESTING
    ? 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl'
    : 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl';
const WSFE_URL = ES_TESTING
    ? 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'
    : 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL';

const CERT = (ES_TESTING ? process.env.AFIP_CERT_TEST : process.env.AFIP_CERT)?.replace(/\\n/g, '\n');
const KEY = (ES_TESTING ? process.env.AFIP_KEY_TEST : process.env.AFIP_KEY)?.replace(/\\n/g, '\n');
const CUIT = process.env.AFIP_CUIT?.replace(/[-\s]/g, '');

let tokenCache = null;
let tokenExpira = null;

async function getToken() {
    if (tokenCache && tokenExpira && new Date() < tokenExpira) {
        return tokenCache;
    }

    const now = new Date();
    const expire = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    
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
    
    tokenCache = { token, sign };
    tokenExpira = expire;
    
    return { token, sign };
}

module.exports = { getToken, CUIT, WSFE_URL };