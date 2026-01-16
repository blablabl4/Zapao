require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function registerAll() {
    try {
        console.log('--- Registering Affiliates ---');

        // === DATA ===
        const eduardo = {
            name: 'Eduardo de Sousa Rocha',
            phone: '11951324444',
            pix: '28701219898'
        };

        const lucas = {
            name: 'Lucas da Silva Rocha',
            phone: '11992339788',
            pix: '46660499830', // Sanitized
            parent: eduardo.phone,
            code: 'lucas-rocha'
        };

        const luiz = {
            name: 'Luiz felipe Pires de Deus',
            phone: '11994027923',
            pix: '57362808844',
            parent: eduardo.phone,
            code: 'luiz-felipe'
        };

        // === HELPERS ===
        async function ensureCustomer(phone, name, pix) {
            // Check
            let res = await pool.query("SELECT * FROM customers WHERE phone = $1", [phone]);
            if (res.rows.length === 0) {
                console.log(`Creating customer ${name} (${phone})...`);
                await pool.query(
                    "INSERT INTO customers (phone, created_at, last_login, name, pix_key) VALUES ($1, NOW(), NOW(), $2, $3)",
                    [phone, name, pix]
                );
            } else {
                console.log(`Updating customer ${name}...`);
                await pool.query(
                    "UPDATE customers SET name = $2, pix_key = $3 WHERE phone = $1",
                    [phone, name, pix]
                );
            }
        }

        async function registerAffiliate(phone, name, pix) {
            let res = await pool.query("SELECT * FROM affiliates WHERE phone = $1", [phone]);
            if (res.rows.length === 0) {
                console.log(`Creating Affiliate ${name}...`);
                await pool.query(
                    "INSERT INTO affiliates (phone, name, pix_key, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
                    [phone, name, pix]
                );
            } else {
                console.log(`Updating Affiliate ${name}...`);
                await pool.query(
                    "UPDATE affiliates SET name = $2, pix_key = $3, updated_at = NOW() WHERE phone = $1",
                    [phone, name, pix]
                );
            }
        }

        async function registerSub(parentPhone, subName, subPhone, pix, code) {
            // Check conflict on code?
            let check = await pool.query("SELECT * FROM sub_affiliates WHERE sub_code = $1", [code]);
            let finalCode = code;
            if (check.rows.length > 0) {
                // If existing sub is NOT this phone, iterate code
                if (check.rows[0].sub_phone !== subPhone) {
                    finalCode = `${code}-${Math.floor(Math.random() * 1000)}`;
                    console.log(`Code taken, using ${finalCode}`);
                }
            }

            let res = await pool.query("SELECT * FROM sub_affiliates WHERE sub_phone = $1", [subPhone]);
            if (res.rows.length === 0) {
                console.log(`Creating Sub-Affiliate ${subName} (Code: ${finalCode})...`);
                await pool.query(
                    "INSERT INTO sub_affiliates (parent_phone, sub_name, sub_phone, pix_key, sub_code, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
                    [parentPhone, subName, subPhone, pix, finalCode]
                );
            } else {
                console.log(`Updating Sub-Affiliate ${subName}...`);
                await pool.query(
                    "UPDATE sub_affiliates SET parent_phone=$1, sub_name=$2, pix_key=$3, sub_code=$4 WHERE sub_phone=$5",
                    [parentPhone, subName, pix, finalCode, subPhone]
                );
            }
            return finalCode;
        }

        // === EXECUTION ===

        // 1. Eduardo
        await ensureCustomer(eduardo.phone, eduardo.name, eduardo.pix);
        await registerAffiliate(eduardo.phone, eduardo.name, eduardo.pix);
        console.log(`✅ Eduardo registered.`);

        // 2. Lucas
        await ensureCustomer(lucas.phone, lucas.name, lucas.pix);
        const codeLucas = await registerSub(lucas.parent, lucas.name, lucas.phone, lucas.pix, lucas.code);
        console.log(`✅ Lucas registered (Code: ${codeLucas}).`);

        // 3. Luiz
        await ensureCustomer(luiz.phone, luiz.name, luiz.pix);
        const codeLuiz = await registerSub(luiz.parent, luiz.name, luiz.phone, luiz.pix, luiz.code);
        console.log(`✅ Luiz registered (Code: ${codeLuiz}).`);

        console.log('\n--- LINKS ---');
        console.log(`Eduardo (Padrinho): https://www.tvzapao.com.br/zapao-da-sorte?ref=${eduardo.phone}`);
        console.log(`Lucas (Sub): https://www.tvzapao.com.br/zapao-da-sorte?ref=${codeLucas}`);
        console.log(`Luiz (Sub): https://www.tvzapao.com.br/zapao-da-sorte?ref=${codeLuiz}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

registerAll();
