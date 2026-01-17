const { query } = require('./src/database/db');

async function checkTotalDebt() {
    try {
        console.log('--- STARTING NET LIQUID DEBT CHECK (MP FEE 0.99% REMOVED) ---');

        // Map to store consolidated data
        const consolidated = new Map();
        const MP_FEE_MULTIPLIER = 0.9901; // 100% - 0.99% = 99.01%

        function getRate(name) {
            if (!name) return 0.20;
            if (name.includes('50%')) return 0.50;
            if (name.includes('25%')) return 0.25;
            // Default rate
            return 0.20;
        }

        function getEntry(phone, name, pix_key) {
            if (!consolidated.has(phone)) {
                consolidated.set(phone, {
                    name: name || 'Unknown',
                    phone: phone,
                    pix_key: pix_key || 'N/A',
                    rate: getRate(name),
                    direct_earnings: 0,
                    parent_bonus: 0,
                    sub_earnings: 0,
                    total_earned: 0,
                    total_paid: 0
                });
            }
            const entry = consolidated.get(phone);
            // Update info if better data found
            if (name && entry.name === 'Unknown') {
                entry.name = name;
                entry.rate = getRate(name); // Update rate if name found later
            }
            if (pix_key && entry.pix_key === 'N/A') entry.pix_key = pix_key;
            return entry;
        }

        // 1. Process Main Affiliates
        const affiliatesRes = await query(`SELECT phone, name, pix_key FROM affiliates`);

        for (const aff of affiliatesRes.rows) {
            const entry = getEntry(aff.phone, aff.name, aff.pix_key);

            // A. Direct Commissions (Rate based on Name)
            // Logic: Sum(amount * MP_Multiplier * Rate)
            // We fetch total sales first to accept simple calc
            const directRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total_sales
                FROM orders 
                WHERE referrer_id = $1 AND status = 'PAID'
            `, [aff.phone]);

            const grossSales = parseFloat(directRes.rows[0].total_sales);
            const netSales = grossSales * MP_FEE_MULTIPLIER;
            entry.direct_earnings = netSales * entry.rate;

            // B. Parent Bonus (Always 5% of Net)
            const bonusRes = await query(`
                SELECT COALESCE(SUM(o.amount), 0) as total_sub_sales
                FROM orders o
                JOIN sub_affiliates sa ON o.referrer_id = sa.sub_code
                WHERE sa.parent_phone = $1 AND o.status = 'PAID'
            `, [aff.phone]);

            const grossBonusSales = parseFloat(bonusRes.rows[0].total_sub_sales);
            const netBonusSales = grossBonusSales * MP_FEE_MULTIPLIER;
            entry.parent_bonus = netBonusSales * 0.05;
        }

        // 2. Process Sub-Affiliates (Personal 5%)
        // Note: Sub stats often don't have 'affiliates' entry, so we check names here too
        const subsRes = await query(`SELECT sub_phone, sub_name, pix_key, sub_code FROM sub_affiliates`);

        for (const sub of subsRes.rows) {
            const entry = getEntry(sub.sub_phone, sub.sub_name, sub.pix_key);

            // C. Sub-link Earnings (5% of Net)
            const subEarnRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM orders
                WHERE referrer_id = $1 AND status = 'PAID'
            `, [sub.sub_code]);

            const grossSubSales = parseFloat(subEarnRes.rows[0].total);
            const netSubSales = grossSubSales * MP_FEE_MULTIPLIER;

            entry.sub_earnings += (netSubSales * 0.05);
        }

        // 3. Payments & Final
        const results = [];
        let grandTotalDebt = 0;
        let countWithDebt = 0;

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
                countWithDebt++;
                results.push({
                    Name: entry.name,
                    Rate: (entry.rate * 100).toFixed(0) + '%',
                    Phone: entry.phone,
                    Balance: `R$ ${entry.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    PixKey: entry.pix_key
                });
            }
        }

        console.log('\n===========================================');
        if (results.length > 0) {
            results.sort((a, b) => {
                const valA = parseFloat(a.Balance.replace('R$ ', '').replace('.', '').replace(',', '.'));
                const valB = parseFloat(b.Balance.replace('R$ ', '').replace('.', '').replace(',', '.'));
                return valB - valA;
            });
            console.table(results);
        } else {
            console.log('No affiliates with outstanding balance found.');
        }
        console.log('===========================================');
        console.log(`TOTAL AFFILIATES: ${countWithDebt}`);
        console.log(`GRAND TOTAL DEBT (TO PAY): R$ ${grandTotalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        console.log('Use of MP Fee Discount: 0.99% deducted from gross sales before commission.');
        console.log('===========================================\n');

        process.exit(0);

    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

checkTotalDebt();
