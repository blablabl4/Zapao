const { query } = require('./src/database/db');

async function check() {
    const phone = '11947781150';
    console.log(`Checking status for Marcos Luiz (${phone})...`);

    // 1. Payments
    const paidRes = await query(`SELECT * FROM affiliate_payments WHERE affiliate_phone = $1`, [phone]);
    console.log('\n--- PAYMENTS ---');
    console.log(paidRes.rows);

    const totalPaid = paidRes.rows.reduce((acc, r) => acc + parseFloat(r.amount), 0);

    // 2. Sales / Commission
    const salesRes = await query(`SELECT sum(amount) as total FROM orders WHERE referrer_id = $1 AND status = 'PAID'`, [phone]);
    const totalSales = parseFloat(salesRes.rows[0].total || 0);
    const commission = totalSales * 0.20;

    // 3. Sub Bonus
    const bonusRes = await query(`
        SELECT COALESCE(SUM(o.amount * 0.05), 0) as total
        FROM orders o
        JOIN sub_affiliates sa ON o.referrer_id = sa.sub_code
        WHERE sa.parent_phone = $1 AND o.status = 'PAID'
    `, [phone]);
    const bonus = parseFloat(bonusRes.rows[0].total);

    const totalEarned = commission + bonus;
    const balance = totalEarned - totalPaid;

    console.log('\n--- SUMMARY ---');
    console.log(`Total Sales:     R$ ${totalSales.toFixed(2)}`);
    console.log(`Direct Comm (20%): R$ ${commission.toFixed(2)}`);
    console.log(`Sub Bonus (5%):    R$ ${bonus.toFixed(2)}`);
    console.log(`-----------------------------`);
    console.log(`TOTAL EARNED:    R$ ${totalEarned.toFixed(2)}`);
    console.log(`TOTAL PAID:      R$ ${totalPaid.toFixed(2)}`);
    console.log(`BALANCE:         R$ ${balance.toFixed(2)}`);

    process.exit(0);
}
check();
