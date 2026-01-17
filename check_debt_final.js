const { query } = require('./src/database/db');

async function checkTotalDebtFinal() {
    try {
        console.log('--- STARTING FINAL DEBT CHECK (50% MAIN / 25% SUB) ---');

        const consolidated = new Map();
        const MP_FEE_MULTIPLIER = 0.9901;

        // 1. Load subs
        const allSubsRes = await query(`SELECT sub_phone FROM sub_affiliates`);
        const subPhones = new Set(allSubsRes.rows.map(r => r.sub_phone));

        function getRate(phone, name) {
            if (subPhones.has(phone)) return 0.25;
            if (name && name.includes('25%')) return 0.25;
            return 0.50;
        }

        function getEntry(phone, name, pix_key) {
            if (!consolidated.has(phone)) {
                consolidated.set(phone, {
                    name: name || 'Unknown',
                    phone: phone,
                    pix_key: pix_key || 'N/A',
                    rate: 0,
                    gross_sales: 0, // NEW: Track Gross Sales
                    direct_earnings: 0,
                    parent_bonus: 0,
                    sub_earnings: 0,
                    total_earned: 0,
                    total_paid: 0
                });
            }
            const entry = consolidated.get(phone);
            if (name && entry.name === 'Unknown') entry.name = name;
            if (pix_key && entry.pix_key === 'N/A') entry.pix_key = pix_key;
            entry.rate = getRate(phone, entry.name);
            return entry;
        }

        // 2. Process All Affiliates
        const affiliatesRes = await query(`SELECT phone, name, pix_key FROM affiliates`);
        for (const aff of affiliatesRes.rows) {
            const entry = getEntry(aff.phone, aff.name, aff.pix_key);

            // A. Direct Commissions
            const directRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total 
                FROM orders 
                WHERE referrer_id = $1 AND status = 'PAID'
            `, [aff.phone]);
            const gross = parseFloat(directRes.rows[0].total);
            entry.gross_sales += gross; // Add to gross tracking

            const net = gross * MP_FEE_MULTIPLIER;
            entry.direct_earnings = net * entry.rate;

            // B. Parent Bonus
            const bonusRes = await query(`
                SELECT COALESCE(SUM(o.amount), 0) as total
                FROM orders o
                JOIN sub_affiliates sa ON o.referrer_id = sa.sub_code
                WHERE sa.parent_phone = $1 AND o.status = 'PAID'
            `, [aff.phone]);
            const grossBonus = parseFloat(bonusRes.rows[0].total);
            entry.parent_bonus = (grossBonus * MP_FEE_MULTIPLIER) * 0.05;
        }

        // 3. Process Sub-Affiliates
        const subsRes = await query(`SELECT sub_phone, sub_name, pix_key, sub_code FROM sub_affiliates`);
        for (const sub of subsRes.rows) {
            const entry = getEntry(sub.sub_phone, sub.sub_name, sub.pix_key);

            // C. Personal Sub-code Earnings
            const subEarnRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM orders
                WHERE referrer_id = $1 AND status = 'PAID'
            `, [sub.sub_code]);
            const gross = parseFloat(subEarnRes.rows[0].total);
            entry.gross_sales += gross; // Add to gross tracking

            const net = gross * MP_FEE_MULTIPLIER;
            entry.sub_earnings += (net * entry.rate);
        }

        // 4. Calculate Final
        const results = [];
        let grandTotalDebt = 0;

        for (const phone of consolidated.keys()) {
            const entry = consolidated.get(phone);
            entry.total_earned = entry.direct_earnings + entry.parent_bonus + entry.sub_earnings;

            const paidRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM affiliate_payments
                WHERE affiliate_phone = $1
            `, [phone]);
            entry.total_paid = parseFloat(paidRes.rows[0].total);
            entry.balance = entry.total_earned - entry.total_paid;

            if (entry.balance > 0.01) {
                grandTotalDebt += entry.balance;
                results.push(entry);
            }
        }

        results.sort((a, b) => b.balance - a.balance);

        console.log('NAME | VENDAS | RATE | SALDO LIQUIDO | PIX');
        results.forEach(r => {
            console.log(`${r.name} | R$ ${r.gross_sales.toFixed(2)} | ${(r.rate * 100).toFixed(0)}% | R$ ${r.balance.toFixed(2)} | ${r.pix_key}`);
        });
        console.log(`TOTAL A PAGAR: R$ ${grandTotalDebt.toFixed(2)}`);

        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkTotalDebtFinal();
