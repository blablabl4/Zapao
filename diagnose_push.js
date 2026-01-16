require('dotenv').config();
const webpush = require('web-push');
const { Pool } = require('pg');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL;

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---');
    console.log('ENV Public Key:', VAPID_PUBLIC_KEY ? VAPID_PUBLIC_KEY.substring(0, 20) + '...' : 'MISSING');
    console.log('ENV Private Key:', VAPID_PRIVATE_KEY ? 'PRESENT' : 'MISSING');
    console.log('ENV Email:', VAPID_EMAIL);

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_EMAIL) {
        console.error('❌ Missing VAPID configuration');
        return;
    }

    try {
        const subject = VAPID_EMAIL || 'mailto:contato@zapao.com.br';
        const finalSubject = subject.startsWith('mailto:') ? subject : `mailto:${subject}`;

        webpush.setVapidDetails(
            finalSubject,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );
        console.log('✅ WebPush configured with subject:', finalSubject);
    } catch (e) {
        console.error('❌ WebPush config failed:', e.message);
        return;
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        const res = await pool.query('SELECT * FROM push_subscriptions');
        console.log(`\nFound ${res.rows.length} subscriptions`);

        if (res.rows.length === 0) {
            console.log('⚠️ No subscribers to test with.');
        } else {
            console.log('Testing send to first subscriber...');
            const sub = res.rows[0];
            console.log('- Endpoint:', sub.endpoint.substring(0, 40) + '...');

            const pushConfig = {
                endpoint: sub.endpoint,
                keys: typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
            };

            try {
                await webpush.sendNotification(pushConfig, JSON.stringify({
                    title: 'Diagnostico',
                    body: 'Teste de diagnostico direto',
                    icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827349.png'
                }));
                console.log('✅ Send SUCCESS! Server accepted the push.');
            } catch (e) {
                console.error('❌ Send FAILED:', e.statusCode, e.body || e.message);
                if (e.statusCode === 401) console.log('👉 Error 401 means VAPID Key mismatch! The user subscribed with a different key than the one in ENV.');
                if (e.statusCode === 410) console.log('👉 Error 410 means Subscription Expired/Unsubscribed.');
            }
        }
    } catch (e) {
        console.error('Database error:', e);
    } finally {
        await pool.end();
        console.log('--- DIAGNOSTIC END ---');
    }
}

diagnose();
