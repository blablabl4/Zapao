const { MercadoPagoConfig, Payment } = require('mercadopago');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

// Just check one ID deeply
const id = '139445586859';

async function debugRaw() {
    try {
        const p = await payment.get({ id });
        console.log(JSON.stringify(p, null, 2));
    } catch (e) {
        console.error(e);
    }
}

debugRaw();
