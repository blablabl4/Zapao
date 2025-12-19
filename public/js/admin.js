// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    // Auto-refresh stats every 5 seconds
    setInterval(loadStats, 5000);
});

/**
 * Load admin statistics
 */
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();

        // Update stat cards
        document.getElementById('statCurrentPrize').textContent =
            `R$ ${stats.current_draw.current_prize.toFixed(2)}`;
        document.getElementById('statPrizeBase').textContent =
            `R$ ${stats.current_draw.prize_base.toFixed(2)}`;
        document.getElementById('statReserve').textContent =
            `R$ ${stats.current_draw.reserve_amount.toFixed(2)}`;
        document.getElementById('statPaidTotal').textContent =
            stats.orders.paid_total;
        document.getElementById('statRevenue').textContent =
            `R$ ${stats.orders.revenue_total_paid.toFixed(2)}`;

        // Show reinforced indicator if applicable
        const currentPrizeCard = document.getElementById('statCurrentPrize').parentElement;
        if (stats.current_draw.is_reinforced) {
            currentPrizeCard.style.border = '2px solid var(--warning)';
        } else {
            currentPrizeCard.style.border = '1px solid var(--border-color)';
        }

        // Update sales lock status
        updateSalesLockStatus(stats.current_draw.sales_locked);

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Update sales lock status display
 */
function updateSalesLockStatus(locked) {
    const statusDiv = document.getElementById('salesLockStatus');
    const btn = document.getElementById('toggleSalesBtn');

    if (locked) {
        statusDiv.innerHTML = '<div class="status-badge status-expired">🔒 Vendas Travadas</div>';
        btn.textContent = '🔓 Destravar Vendas';
        btn.className = 'btn btn-success';
    } else {
        statusDiv.innerHTML = '<div class="status-badge status-paid">✅ Vendas Abertas</div>';
        btn.textContent = '🔒 Travar Vendas';
        btn.className = 'btn btn-primary';
    }
}

/**
 * Toggle sales lock
 */
async function toggleSales() {
    const response = await fetch('/api/admin/stats');
    const stats = await response.json();
    const currentlyLocked = stats.current_draw.sales_locked;

    const action = currentlyLocked ? 'destravar' : 'travar';
    if (!confirm(`Confirmar ${action} vendas?`)) {
        return;
    }

    try {
        const response = await fetch('/api/admin/toggle-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locked: !currentlyLocked })
        });

        if (!response.ok) {
            throw new Error('Erro ao alterar status de vendas');
        }

        const result = await response.json();

        updateSalesLockStatus(result.sales_locked);

        alert(`✅ Vendas ${result.sales_locked ? 'travadas' : 'destravadas'} com sucesso!`);
        await loadStats();

    } catch (error) {
        console.error('Error toggling sales:', error);
        alert('Erro ao alterar status de vendas: ' + error.message);
    }
}

/**
 * Close current draw
 */
async function closeDraw() {
    const drawnNumberInput = document.getElementById('drawnNumber');
    const drawnNumber = parseInt(drawnNumberInput.value);

    // Validate input
    if (isNaN(drawnNumber) || drawnNumber < 0 || drawnNumber > 99) {
        alert('Por favor, digite um número válido entre 0 e 99');
        return;
    }

    // Confirm action
    if (!confirm(`Confirmar encerramento da rodada com o número ${drawnNumber.toString().padStart(2, '0')}?`)) {
        return;
    }

    try {
        const response = await fetch('/api/admin/close-draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drawn_number: drawnNumber })
        });

        if (!response.ok) {
            throw new Error('Erro ao encerrar rodada');
        }

        const result = await response.json();

        // Display results
        displayResults(result);

        // Clear input
        drawnNumberInput.value = '';

        // Reload stats
        await loadStats();

    } catch (error) {
        console.error('Error closing draw:', error);
        alert('Erro ao encerrar rodada: ' + error.message);
    }
}

/**
 * Display draw results
 */
function displayResults(result) {
    const resultsSection = document.getElementById('resultsSection');
    const resultSummary = document.getElementById('resultSummary');
    const winnersTable = document.getElementById('winnersTable');
    const winnersTableBody = document.getElementById('winnersTableBody');
    const noWinnersMessage = document.getElementById('noWinnersMessage');

    // Show results section
    resultsSection.style.display = 'block';

    // Build summary
    const summaryHtml = `
        <div class="stat-card">
            <h3>Número Sorteado</h3>
            <div class="value" style="font-size: 3rem;">${result.drawn_number.toString().padStart(2, '0')}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
            <div class="stat-card">
                <h3>Ganhadores</h3>
                <div class="value">${result.winners_count}</div>
            </div>
            <div class="stat-card">
                <h3>Prêmio Total</h3>
                <div class="value">R$ ${result.total_prize.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <h3>Prêmio por Ganhador</h3>
                <div class="value">R$ ${result.payout_each.toFixed(2)}</div>
            </div>
        </div>
    `;
    resultSummary.innerHTML = summaryHtml;

    if (result.winners_count > 0) {
        // Show winners table
        winnersTable.style.display = 'block';
        noWinnersMessage.style.display = 'none';

        // Build table rows
        winnersTableBody.innerHTML = result.winners.map(winner => `
            <tr>
                <td style="font-family: monospace; font-size: 0.85rem;">${winner.order_id.substring(0, 8)}...</td>
                <td>${new Date(winner.paid_at).toLocaleString('pt-BR')}</td>
                <td>R$ ${winner.amount.toFixed(2)}</td>
                <td style="color: var(--success); font-weight: bold;">R$ ${result.payout_each.toFixed(2)}</td>
            </tr>
        `).join('');

    } else {
        // Show no winners message
        winnersTable.style.display = 'none';
        noWinnersMessage.style.display = 'block';

        document.getElementById('newReserveInfo').textContent =
            `Nova reserva: R$ ${result.new_reserve.toFixed(2)}`;
    }

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Search for buyers by number with FULL DATA
 */
async function searchByNumber() {
    const searchNumber = parseInt(document.getElementById('searchNumber').value);

    if (isNaN(searchNumber) || searchNumber < 0 || searchNumber > 99) {
        alert('Por favor, digite um número válido entre 0 e 99');
        return;
    }

    const searchResults = document.getElementById('searchResults');
    const searchSummary = document.getElementById('searchSummary');
    const searchBuyersTable = document.getElementById('searchBuyersTable');

    searchSummary.innerHTML = '<p style="color: var(--text-secondary);">Buscando...</p>';
    searchResults.style.display = 'block';
    searchBuyersTable.innerHTML = '';

    try {
        // Use the detailed buyers endpoint
        const response = await fetch(`/api/orders/buyers/${searchNumber}`);
        const data = await response.json();

        const count = data.count;

        if (count === 0) {
            searchSummary.innerHTML = `
                <div class="info-section">
                    <h3>Número ${searchNumber.toString().padStart(2, '0')}</h3>
                    <p style="color: var(--text-secondary);">Nenhuma compra registrada para este número.</p>
                </div>
            `;
            return;
        }

        // Show count
        searchSummary.innerHTML = `
            <div class="stat-card">
                <h3>Número ${searchNumber.toString().padStart(2, '0')}</h3>
                <div class="value">${count}</div>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                    ${count === 1 ? 'compra registrada' : 'compras registradas'}
                </p>
            </div>
        `;

        // Show detailed buyer table
        searchBuyersTable.innerHTML = `
            <h3 style="margin: 1.5rem 0 1rem 0; color: var(--text-secondary);">Compradores:</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color);">
                        <th style="text-align: left; padding: 0.75rem; color: var(--text-secondary);">Nome</th>
                        <th style="text-align: left; padding: 0.75rem; color: var(--text-secondary);">Celular</th>
                        <th style="text-align: left; padding: 0.75rem; color: var(--text-secondary);">Nascimento</th>
                        <th style="text-align: left; padding: 0.75rem; color: var(--text-secondary);">Pago em</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.buyers.map(b => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 0.75rem;">${b.buyer.name || '-'}</td>
                            <td style="padding: 0.75rem;">${b.buyer.phone || '-'}</td>
                            <td style="padding: 0.75rem;">${b.buyer.birthdate ? new Date(b.buyer.birthdate).toLocaleDateString('pt-BR') : '-'}</td>
                            <td style="padding: 0.75rem;">${new Date(b.paid_at).toLocaleString('pt-BR')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    } catch (error) {
        console.error('Error searching:', error);
        searchSummary.innerHTML = '<p style="color: var(--warning);">Erro ao buscar. Tente novamente.</p>';
    }
}
