
// ==========================================
// ADMIN DASHBOARD
// ==========================================

let currentDraw = null;
let currentStats = null;
let isSpinning = false;
let paymentsList = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Fix Title on load if needed
    const modalTitle = document.querySelector('#slotModal h2');
    if (modalTitle && modalTitle.innerText.includes('SORTEADOR VISUAL')) {
        modalTitle.innerText = '🎰 ROLETA DA SORTE';
    }

    // Tab Navigation
    document.getElementById('tab-sales').addEventListener('click', () => switchTab('sales'));
    document.getElementById('tab-history').addEventListener('click', () => switchTab('history'));
});

function switchTab(tabName) {
    // Reset tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('view-sales').style.display = 'none';
    document.getElementById('view-history').style.display = 'none';
    const rankingView = document.getElementById('view-ranking');
    if (rankingView) rankingView.style.display = 'none';
    const financeView = document.getElementById('view-financial');
    if (financeView) financeView.style.display = 'none';
    const affiliateView = document.getElementById('view-affiliates');
    if (affiliateView) affiliateView.style.display = 'none';
    const analyticsView = document.getElementById('view-analytics');
    if (analyticsView) analyticsView.style.display = 'none';

    // Activate
    const tabBtn = document.getElementById(`tab-${tabName}`);
    if (tabBtn) tabBtn.classList.add('active');

    const viewDiv = document.getElementById(`view-${tabName}`);
    if (viewDiv) viewDiv.style.display = 'block';

    if (tabName === 'history') {
        loadWinnersHistory();
    } else if (tabName === 'ranking') {
        loadRanking();
    } else if (tabName === 'financial') {
        loadFinancials();
    } else if (tabName === 'affiliates') {
        if (typeof checkAffiliateStats === 'function') {
            checkAffiliateStats();
        }
    } else if (tabName === 'analytics') {
        loadPurchaseDistribution();
    }
}

async function loadPurchaseDistribution() {
    const tbody = document.getElementById('distributionTableBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Carregando...</td></tr>';

        const res = await fetch('/api/admin/purchase-distribution');
        const data = await res.json();

        if (!data.distribution || data.distribution.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Nenhum dado disponível</td></tr>';
            return;
        }

        const totalCustomers = data.totals.customers || 1;

        let html = '';
        data.distribution.forEach(row => {
            const pct = ((parseInt(row.customer_count) / totalCustomers) * 100).toFixed(1);
            html += `
                <tr>
                    <td style="font-weight:bold; color:var(--gold);">${row.range} tickets</td>
                    <td style="text-align:center;">${row.customer_count}</td>
                    <td style="text-align:center; color:#4ade80;">${row.total_tickets}</td>
                    <td style="text-align:right; color:var(--text-secondary);">${pct}%</td>
                </tr>
            `;
        });

        // Add totals row
        html += `
            <tr style="border-top: 2px solid var(--border-color); font-weight: bold;">
                <td>TOTAL</td>
                <td style="text-align:center;">${data.totals.customers}</td>
                <td style="text-align:center; color:#4ade80;">${data.totals.tickets}</td>
                <td style="text-align:right;">100%</td>
            </tr>
        `;

        tbody.innerHTML = html;

    } catch (e) {
        console.error('Error loading distribution:', e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color: red;">Erro ao carregar</td></tr>';
    }
}

async function initDashboard() {
    await loadStats();
    await loadPayments();

    // Auto refresh every 30s
    setInterval(() => {
        if (!isSpinning) {
            loadStats();
            loadPayments();
        }
    }, 30000);
}

// ========== STATS & STATE ==========

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();

        if (data.current_draw) {
            currentDraw = data.current_draw;
            updateHeaderInfo(currentDraw);
            updateControlPanel(currentDraw);
        }

        if (data.orders) {
            currentStats = data.orders;
            updateStatsGrid(data);
        }

    } catch (e) {
        console.error("Error loading stats:", e);
    }
}

function updateHeaderInfo(draw) {
    const nameEl = document.getElementById('currentDrawName');
    const infoEl = document.getElementById('currentDrawInfo');

    if (draw.status === 'INACTIVE') {
        nameEl.textContent = "Nenhuma Ativa";
        infoEl.style.borderColor = "#666";
        nameEl.style.color = "#888";
    } else {
        nameEl.textContent = draw.draw_name || `Rodada #${draw.id}`;
        infoEl.style.borderColor = "var(--gold)";
        nameEl.style.color = "var(--gold-light)";
    }
}

function updateStatsGrid(data) {
    const { current_draw, orders } = data;

    // Use Intl for currency
    const fmtMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // 1. Prize (Guaranteed)
    const prizeEl = document.getElementById('statCurrentPrize');
    if (prizeEl) prizeEl.innerText = fmtMoney(data.current_draw.current_prize);

    // 2. Unique Customers
    const uniqueEl = document.getElementById('statUniqueCustomers');
    if (uniqueEl) uniqueEl.innerText = data.orders.unique_customers || 0;

    // 3. Paid Sales
    const paidEl = document.getElementById('statPaidTotal');
    if (paidEl) paidEl.innerText = data.orders.paid_total || 0;

    // 4. Time Remaining
    if (current_draw && current_draw.end_time) {
        startCountdown(current_draw.end_time);
    } else {
        const timeEl = document.getElementById('statTimeRemaining');
        if (timeEl) timeEl.innerText = "--:--";
    }

    // 5. Revenue
    const revEl = document.getElementById('statRevenue');
    if (revEl) revEl.innerText = fmtMoney(data.orders.revenue_total_paid);
}

let countdownInterval = null;

function startCountdown(targetDateStr) {
    const timeEl = document.getElementById('statTimeRemaining');
    if (!timeEl) return;

    // Clear previous
    if (countdownInterval) clearInterval(countdownInterval);

    const targetDate = new Date(targetDateStr);

    function update() {
        const now = new Date();
        const diff = targetDate - now;

        if (diff <= 0) {
            timeEl.innerText = "Encerrado";
            timeEl.style.color = "#ef4444"; // Red
            clearInterval(countdownInterval);
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Format like sales page: 00d 00h 00m 00s
        const dStr = days.toString().padStart(2, '0');
        const hStr = hours.toString().padStart(2, '0');
        const mStr = minutes.toString().padStart(2, '0');
        const sStr = seconds.toString().padStart(2, '0');

        if (days > 0) {
            timeEl.innerText = `${dStr}d ${hStr}h ${mStr}m ${sStr}s`;
        } else {
            timeEl.innerText = `${hStr}h ${mStr}m ${sStr}s`;
        }
        timeEl.style.color = "var(--gold)";
    }

    update(); // Immediate
    countdownInterval = setInterval(update, 1000); // Update every second
}

function updateControlPanel(draw) {
    const btn = document.getElementById('toggleSalesBtn');
    const badge = document.getElementById('salesLockStatus');

    if (draw.sales_locked) {
        badge.innerHTML = '<span class="status-badge locked">Vendas Pausadas</span>';
        btn.textContent = 'Liberar Vendas';
        btn.className = 'btn btn-success'; // Green to unpause
    } else {
        badge.innerHTML = '<span class="status-badge active">Vendas Abertas</span>';
        btn.textContent = 'Pausar Vendas';
        btn.className = 'btn btn-danger'; // Red to pause
    }
}

// ========== ACTIONS ==========

async function togglePause() {
    if (!currentDraw || !currentDraw.id) return alert("Nenhuma rifa ativa.");

    const action = currentDraw.sales_locked ? 'liberar' : 'pausar';
    if (!confirm(`Deseja realmente ${action} as vendas?`)) return;

    try {
        const res = await fetch('/api/admin/toggle-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                draw_id: currentDraw.id,
                locked: !currentDraw.sales_locked
            })
        });

        if (res.ok) {
            loadStats(); // Reload to update UI
        } else {
            const err = await res.json();
            alert("Erro: " + err.error);
        }
    } catch (e) {
        alert("Erro de conexão");
    }
}

async function startNewDraw() {
    const prize = document.getElementById('configPrize').value;
    const date = document.getElementById('configDrawDate').value;
    const time = document.getElementById('configDrawTime').value;
    const name = document.getElementById('configDrawName').value;

    if (!prize || !date || !time) {
        alert("Preencha todos os campos obrigatórios (Prêmio, Data e Hora)");
        return;
    }

    if (!confirm("Iniciar nova rifa agora? A anterior será arquivada.")) return;

    const statusDiv = document.getElementById('configStatus');
    statusDiv.textContent = "Criando...";
    statusDiv.style.color = "#ecc";

    try {
        const res = await fetch('/api/admin/start-draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prize_base: prize,
                scheduled_date: date,
                scheduled_time: time,
                draw_name: name
            })
        });

        const data = await res.json();
        if (res.ok) {
            statusDiv.textContent = "Sucesso!";
            statusDiv.style.color = "#4ade80";
            alert("Nova rifa iniciada com sucesso!");
            loadStats();
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        statusDiv.textContent = "Erro: " + e.message;
        statusDiv.style.color = "#f87171";
    }
}

// ========== BRANDING ==========
async function saveCampaignBranding() {
    const title = document.getElementById('campaignTitle').value;
    const fileInput = document.getElementById('campaignBannerFile');
    const statusDiv = document.getElementById('brandingStatus');

    const formData = new FormData();
    if (title) formData.append('title', title);
    if (fileInput.files[0]) formData.append('banner', fileInput.files[0]);

    statusDiv.textContent = "Salvando...";

    try {
        const res = await fetch('/api/admin/branding', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            statusDiv.textContent = "Salvo com sucesso!";
            statusDiv.style.color = "#4ade80";
            setTimeout(() => statusDiv.textContent = "", 3000);
        } else {
            throw new Error("Falha ao salvar");
        }
    } catch (e) {
        statusDiv.textContent = "Erro ao salvar";
        statusDiv.style.color = "#f87171";
    }
}

// ========== PAYMENTS LIST ==========
async function loadPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    const countSpan = document.getElementById('paymentCount');

    try {
        const res = await fetch('/api/admin/payments');
        const data = await res.json();

        // Handle object wrapper
        paymentsList = data.payments || [];

        // COUNT STATUS
        const stats = {
            total: paymentsList.length,
            paid: paymentsList.filter(p => p.status === 'PAID').length,
            pending: paymentsList.filter(p => p.status === 'PENDING').length,
            expired: paymentsList.filter(p => p.status === 'EXPIRED').length
        };

        // Detailed Status Display
        countSpan.innerHTML = `
            <span style="color:#fff">${stats.total} Total</span> | 
            <span style="color:#4ade80">${stats.paid} Pagos</span> | 
            <span style="color:#facc15">${stats.pending} Pend.</span> | 
            <span style="color:#f87171">${stats.expired} Exp.</span>
        `;

        if (paymentsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #666;">Nenhum pagamento encontrado</td></tr>';
            return;
        }

        // Group duplicates (Same Number + Same Buyer + Same Status)
        const groupedMap = new Map();

        paymentsList.forEach(p => {
            // Key: Number + Phone + Status
            // Use phone as unique ID for buyer if available, else name
            const key = `${p.number}-${p.buyer_phone || p.buyer_name}-${p.status}`;

            if (groupedMap.has(key)) {
                const existing = groupedMap.get(key);
                existing.count += 1;
                existing.amount += parseFloat(p.amount);
                // Keep the latest date? Or earliest? Let's keep latest.
                if (new Date(p.created_at) > new Date(existing.created_at)) {
                    existing.created_at = p.created_at;
                }
            } else {
                groupedMap.set(key, {
                    ...p,
                    count: 1,
                    amount: parseFloat(p.amount)
                });
            }
        });

        const groupedList = Array.from(groupedMap.values());

        // Sort by Created At Desc
        groupedList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        tbody.innerHTML = groupedList.map(p => {
            const date = new Date(p.created_at).toLocaleString('pt-BR');
            const statusClass = p.status.toLowerCase();
            let statusLabel = p.status;
            if (statusLabel === 'PAID') statusLabel = 'PAGO';
            if (statusLabel === 'PENDING') statusLabel = 'PENDENTE';
            if (statusLabel === 'EXPIRED') statusLabel = 'EXPIRADO';

            // Badge for count
            const countBadge = p.count > 1
                ? `<span style="background:var(--gold); color:#000; padding:2px 6px; border-radius:10px; font-size:0.75rem; font-weight:bold; margin-left:5px;">x${p.count}</span>`
                : '';

            return `
                <tr>
                    <td><strong>${p.number || p.numbers || '-'}</strong>${countBadge}</td>
                    <td>${toTitleCase(p.buyer_name) || 'Desconhecido'}</td>
                    <td>${formatTelefone(p.buyer_phone)}</td>
                    <td>R$ ${parseFloat(p.amount).toFixed(2)}</td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                    <td style="font-size: 0.8rem; color: #888;">${date}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Erro ao carregar pagamentos</td></tr>';
    }
}

// ========== WINNERS HISTORY ==========
async function loadWinnersHistory() {
    const tbody = document.getElementById('winnersHistoryBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Carregando...</td></tr>';

    try {
        // Fetch ALL completed draws
        const res = await fetch('/api/public/draws');
        const data = await res.json();
        const draws = data.draws || []; // FIX: array is inside 'draws' key

        // Filter only those with winners
        const winners = draws.filter(d => d.status === 'CLOSED' && d.winning_number !== null);

        if (winners.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#666;">Nenhum histórico disponível.</td></tr>';
            return;
        }

        // Sort by date desc
        winners.sort((a, b) => b.id - a.id); // Sort by ID/Date

        tbody.innerHTML = winners.flatMap(w => {
            // w.winners is an array of { name, phone, pix, date ... }

            // If no winners list or empty, show one row indicating 'Sem Ganhador'
            if (!w.winners || w.winners.length === 0) {
                const dateStr = w.closed_at ? new Date(w.closed_at).toLocaleString('pt-BR') : '-';
                return [`
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 1rem;">${w.name || '#' + w.id}</td>
                        <td style="padding: 1rem; color: var(--gold); font-weight: bold;">${w.winning_number}</td>
                        <td style="padding: 1rem; color: #666;">Sem ganhador</td>
                        <td style="padding: 1rem;">-</td>
                        <td style="padding: 1rem;">-</td>
                        <td style="padding: 1rem;">R$ ${parseFloat(w.prize).toFixed(2)}</td>
                        <td style="padding: 1rem; color: var(--text-secondary);">${dateStr}</td>
                    </tr>
                `];
            }

            // Iterate over winners to create one row per winner
            return w.winners.map(p => {
                // Use date from specific winner or draw
                const dateRaw = p.date || w.closed_at;
                const dateStr = dateRaw ? new Date(dateRaw).toLocaleString('pt-BR') : '-';

                return `
                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                        <td style="padding: 0.75rem;">${w.name || '#' + w.id}</td>
                        <td style="padding: 0.75rem; color: var(--gold); font-weight: bold;">${w.winning_number}</td>
                        <td style="padding: 0.75rem;">${toTitleCase(p.name)}</td>
                        <td style="padding: 0.75rem;">${formatTelefone(p.phone)}</td>
                        <td style="padding: 0.75rem;">${formatPixKey(p.pix)}</td>
                        <td style="padding: 0.75rem;">R$ ${parseFloat(w.payout_each || (w.prize / w.winners.length)).toFixed(2)}</td>
                        <td style="padding: 0.75rem; color: var(--text-secondary);">${dateStr}</td>
                    </tr>
                `;
            });
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Erro: ${e.message}</td></tr>`;
    }
}

// ========== EDIT TIME ==========

function openEditTimeModal() {
    if (!currentDraw || !currentDraw.start_time) return alert("Nenhuma rifa ativa para editar.");

    // We can just prompt for new date/time for simplicity instead of a full modal HTML
    // Or reuse a simple logic
    try {
        const currentIso = currentDraw.scheduled_for || currentDraw.end_time || new Date().toISOString();
        const dateObj = new Date(currentIso);

        // Format for input default (YYYY-MM-DD and HH:MM)
        const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const newDate = prompt("Nova Data (AAAA-MM-DD):", dateStr);
        if (!newDate) return; // Cancelled

        const newTime = prompt("Novo Horário (HH:MM):", timeStr);
        if (!newTime) return; // Cancelled

        // Confirm
        if (!confirm(`Alterar sorteio para ${newDate} às ${newTime}?`)) return;

        // Call Edit API is complex via prompt, ideally we have a dedicated endpoint.
        // Assuming we do:
        updateDrawTime(newDate, newTime);

    } catch (e) {
        console.error("Error editing time:", e);
    }
}

async function loadRanking() {
    const tbody = document.getElementById('rankingTableBody');
    const stats = document.getElementById('rankingStats');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem;">Carregando...</td></tr>';

    try {
        const res = await fetch('/api/admin/ranking');
        const data = await res.json();

        if (!data.ranking || data.ranking.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem;">Nenhuma venda confirmada ainda.</td></tr>';
            stats.innerHTML = '';
            return;
        }

        stats.innerHTML = `(Top ${data.ranking.length} números)`;

        tbody.innerHTML = data.ranking.map((r, index) => {
            let status = '';
            if (index === 0) status = '👑 Líder';
            else if (index < 5) status = '🔥 Quente';
            else status = '-';

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 1rem; font-weight: bold; color: ${index === 0 ? 'gold' : 'inherit'}">#${index + 1}</td>
                    <td style="padding: 1rem; font-size: 1.2rem;">${r.number}</td>
                    <td style="padding: 1rem;">${r.sales_count} vendas</td>
                    <td style="padding: 1rem;">${status}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Erro: ${e.message}</td></tr>`;
    }
}

async function updateDrawTime(date, time) {
    try {
        const editResponse = await fetch('/api/admin/edit-draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scheduled_date: date,
                scheduled_time: time
            })
        });

        if (!editResponse.ok) {
            const err = await editResponse.json();
            throw new Error(err.error || 'Erro ao editar');
        }

        alert('✅ Horário atualizado com sucesso!');
        loadStats();
    } catch (e) {
        alert("Erro ao editar horário: " + e.message);
    }
}

// ========== SLOT MACHINE (VISUAL 3D ROULETTE) ==========
const TOTAL_NUMBERS = 150;
let currentIndex = 0; // This is now index in SHUFFLED array
let animationFrameId = null;
let audioCtx = null;

// SHUFFLED NUMBERS ARRAY (For Random Visual Order)
// We generate this once so the order is consistent during a session, 
// creating the illusion of a specific physical wheel layout.
const SHUFFLED_NUMBERS = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5);

// Helper: Get adjacent numbers from shuffled array
function getAdjacentNumbers(index) {
    const leftIndex = ((index - 1) + TOTAL_NUMBERS) % TOTAL_NUMBERS;
    const rightIndex = (index + 1) % TOTAL_NUMBERS;

    return {
        left: SHUFFLED_NUMBERS[leftIndex],
        center: SHUFFLED_NUMBERS[index],
        right: SHUFFLED_NUMBERS[rightIndex]
    };
}

// Helper: Update DOM
function updateDisplay(index) {
    const nums = getAdjacentNumbers(index);
    const elLeft = document.getElementById('numLeft');
    const elCenter = document.getElementById('numCenter');
    const elRight = document.getElementById('numRight');

    if (elLeft) elLeft.textContent = nums.left.toString().padStart(2, '0');
    if (elCenter) elCenter.textContent = nums.center.toString().padStart(2, '0');
    if (elRight) elRight.textContent = nums.right.toString().padStart(2, '0');
}

// Helper: Play Sound (Safely)
function playTick() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume context on mobile if suspended
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => { });
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.frequency.value = 800 + Math.random() * 200;
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
        // Silent fail
    }
}

// Helper: Toggle Transitions for Smoothness
function setTransition(enabled) {
    const cards = document.querySelectorAll('.number-card');
    cards.forEach(card => {
        card.style.transition = enabled ? 'all 0.1s cubic-bezier(0.2, 0, 0, 1)' : 'none';
        // When enabled, allow smooth interpolation. When disabled, instant updates.
        // We use 'none' for high-speed to avoid browser render lag.
    });
}

/**
 * Open the visual roulette modal
 */
function openSlotMachine() {
    const modal = document.getElementById('slotModal');
    if (modal) {
        modal.style.display = 'flex';

        // Fix title here dynamically
        const h2 = modal.querySelector('h2');
        if (h2) h2.textContent = '🎰 ROLETA DA SORTE';

        // Reset state
        const spinBtn = document.getElementById('spinBtn');
        const status = document.getElementById('slotStatus');
        const centerCard = document.getElementById('numCenter');

        spinBtn.style.display = 'block';
        spinBtn.disabled = false;
        spinBtn.innerHTML = '<i class="fas fa-play" style="margin-right: 8px;"></i> Girar Roleta';
        status.textContent = 'Clique para girar!';
        status.style.opacity = '1';
        centerCard.classList.remove('winner');

        isSpinning = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        // Pick random start position
        currentIndex = Math.floor(Math.random() * TOTAL_NUMBERS);
        updateDisplay(currentIndex);
    }
}

/**
 * Close the modal
 */
function closeSlotModal() {
    const modal = document.getElementById('slotModal');
    if (modal) {
        modal.style.display = 'none';
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        isSpinning = false;
    }
}

/**
 * Spin Logic (Visual Only)
 */
// Helper to title case (Global Scope for access)
const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Helper: Format Phone (XX) 9XXXX-XXXX
const formatTelefone = (phone) => {
    if (!phone) return '-';
    // Remove non-digits
    const nums = phone.replace(/\D/g, '');

    // Check if valid length (10 or 11)
    if (nums.length === 11) {
        return `(${nums.substring(0, 2)}) ${nums.substring(2, 7)}-${nums.substring(7)}`;
    } else if (nums.length === 10) {
        // If 10 digits, assume 3rd digit should be 9 if user requested? 
        // Or just format as old style (XX) XXXX-XXXX
        return `(${nums.substring(0, 2)}) ${nums.substring(2, 6)}-${nums.substring(6)}`;
    }
    return phone; // Return original if unknown format
};

// Helper: Format CPF XXX.XXX.XXX-XX
const formatCPF = (cpf) => {
    const nums = cpf.replace(/\D/g, '');
    if (nums.length !== 11) return cpf;
    return `${nums.substring(0, 3)}.${nums.substring(3, 6)}.${nums.substring(6, 9)}-${nums.substring(9)}`;
};

// Helper: Validate CPF (Modulo 11)
const isValidCPF = (cpf) => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;

    let sum = 0;
    let remainder;

    // First Digit
    for (let i = 1; i <= 9; i++) sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(clean.substring(9, 10))) return false;

    // Second Digit
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(clean.substring(10, 11))) return false;

    return true;
};

// Helper: Format Pix Key (Prioritizes Valid CPF > Phone > Generic)
const formatPixKey = (key) => {
    if (!key) return '-';
    const clean = key.replace(/\D/g, '');

    // Check if Email (contains @)
    if (key.includes('@')) return key;

    // Check if Random Key (Longer than 11 chars usually)
    if (clean.length > 11) return key;

    // Distinguish CPF vs Phone (Both 11 digits often)
    if (clean.length === 11) {
        // 1. Validate if it is a REAL CPF
        if (isValidCPF(clean)) {
            return formatCPF(clean);
        }

        // 2. If not valid CPF, check if it fits User's Phone Rule
        // "3rd digit mandatory 9"
        if (clean.charAt(2) === '9') {
            return formatTelefone(clean);
        }

        // 3. Fallback: Treat as CPF (Invalid)
        return formatCPF(clean);
    }

    return key;
};

async function spinSlots() {
    if (isSpinning) return;

    try {
        isSpinning = true;

        // Wake up audio context (Attempt only)
        playTick();

        const spinBtn = document.getElementById('spinBtn');
        const status = document.getElementById('slotStatus');
        const centerCard = document.getElementById('numCenter');

        // UX: Hide Button and Clear Status during spin
        spinBtn.style.display = 'none';
        status.textContent = '';
        status.style.opacity = '0';
        centerCard.classList.remove('winner');

        // SECRET: Fetch determined number from backend (Weighted Rule)
        let targetNumber;
        try {
            const res = await fetch('/api/admin/draw-secret');
            const data = await res.json();
            if (data.success && data.number) {
                targetNumber = parseInt(data.number);
            } else {
                throw new Error('No number returned');
            }
        } catch (e) {
            console.error('Secret Draw Failed, falling back to random:', e);
            // Fallback: Generate purely local random number (1-150)
            targetNumber = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
        }

        status.textContent = '';
        status.style.opacity = '0';

        // Find where this number is in our shuffled array
        const targetIndex = SHUFFLED_NUMBERS.indexOf(targetNumber);

        // Initial Physics Config
        let position = currentIndex;
        let speed = 0;
        const maxSpeed = 0.85; // Target Max Speed
        const accel = 0.02;

        setTransition(false); // Disable CSS transition for smooth frame-by-frame JS loop

        // Phase 1: Accelerate & Cruise
        // Phase 2: Decelerate with constant deceleration

        let phase = 'ACCEL'; // ACCEL, CRUISE, DECEL
        let lastTime = performance.now();

        // VARIABLES FOR DECELERATION
        let decelDistance = 0;
        let deceleration = 0;

        function loop(now) {
            try {
                const dt = Math.min((now - lastTime) / 16.66, 2);
                lastTime = now;

                // State Machine
                if (phase === 'ACCEL') {
                    speed += accel * dt;
                    if (speed >= maxSpeed) {
                        speed = maxSpeed;
                        phase = 'CRUISE';
                        // Cruise for 3 seconds
                        setTimeout(() => { phase = 'PREPARE_STOP'; }, 3000);
                    }
                }
                else if (phase === 'CRUISE') {
                    // Constant speed, no change
                }
                else if (phase === 'PREPARE_STOP') {
                    // WE NEED TO CALCULATE A PERFECT STOP
                    // We want to stop exactly at targetIndex.
                    // Distance to target in array indices:
                    const currentPosRaw = position;
                    const distToTarget = (targetIndex - currentPosRaw + TOTAL_NUMBERS) % TOTAL_NUMBERS;

                    // We want to do at least 5 full rotations (375 items) to feel "heavy"
                    const minRotations = 7;
                    const extraItems = minRotations * TOTAL_NUMBERS;
                    const totalStopDistance = extraItems + distToTarget;

                    // PHYSICS: v^2 = u^2 + 2as. We want v=0.
                    // 0 = speed^2 + 2 * a * distance
                    // a = -(speed^2) / (2 * distance)
                    // This 'a' is negative, so deceleration = -a = speed^2 / 2s.

                    decelDistance = totalStopDistance;
                    deceleration = (speed * speed) / (2 * totalStopDistance);

                    phase = 'STOPPING';
                }
                else if (phase === 'STOPPING') {
                    // Velocity update: v = v - a * dt
                    speed -= deceleration * dt;

                    if (speed <= 0.005) { // Threshold specifically low
                        speed = 0;
                        phase = 'FINISHED';
                    }
                }

                // Apply movement
                position += speed * dt;

                // Update DOM
                const rawIndex = Math.floor(position);
                const actualIndex = ((rawIndex % TOTAL_NUMBERS) + TOTAL_NUMBERS) % TOTAL_NUMBERS;

                if (actualIndex !== currentIndex) {
                    // Tick sound: threshold based to avoid buzz
                    const shouldPlay = (speed < 0.5) || ((actualIndex % 2) === 0);
                    if (shouldPlay && speed > 0) playTick();

                    currentIndex = actualIndex;
                    updateDisplay(currentIndex);
                }

                if (phase !== 'FINISHED') {
                    animationFrameId = requestAnimationFrame(loop);
                } else {
                    finalizeStop(targetIndex);
                }
            } catch (loopErr) {
                console.error("Animation Loop Error:", loopErr);
                isSpinning = false; // Emergency release
                spinBtn.style.display = 'block'; // Show button again
            }
        }

        // Start Engine
        animationFrameId = requestAnimationFrame(loop);

        function finalizeStop(finalIdx) {
            isSpinning = false;

            // Final snap visual
            currentIndex = finalIdx;
            updateDisplay(currentIndex);
            setTransition(true);
            centerCard.classList.add('winner');

            // Winner Lookup
            const finalVal = SHUFFLED_NUMBERS[currentIndex];
            // Find ALL paid orders for this number
            const winningOrders = paymentsList.filter(p => (p.number == finalVal || p.numbers == finalVal) && p.status === 'PAID');

            let displayText = '';
            if (winningOrders.length > 0) {
                // User Request: "se for mais de um ganhador tem que mostrar todos!!"
                // User Request: "apenas a info do bairo" (no phone)

                const winnerText = winningOrders.map(w => {
                    const bairro = w.buyer_bairro || 'Local não informado';

                    const cleanName = toTitleCase(w.buyer_name);
                    const cleanBairro = toTitleCase(bairro);

                    return `
                        <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 1.4rem; font-weight: bold; color: #4ade80; margin-bottom: 5px; text-shadow: 0 0 10px rgba(74, 222, 128, 0.3);">
                                🏆 ${cleanName}
                            </div>
                            <div style="font-size: 0.9rem; color: #aaa; font-weight: normal; font-style: italic;">
                                <i class="fas fa-map-marker-alt" style="margin-right: 5px;"></i> ${cleanBairro}
                            </div>
                        </div>
                    `;
                }).join('');

                displayText = winnerText;
                status.style.color = '#4ade80';
            } else {
                // USER REQUEST: colocou "rodada sem ganhador"
                displayText = `🚫 Rodada sem ganhador (Nº ${finalVal})`;
                status.style.color = '#f87171'; // Red/Warning color
            }

            status.innerHTML = displayText;
            status.style.opacity = '1';
            status.style.fontSize = '1.3rem';

            spinBtn.style.display = 'block';
            spinBtn.innerHTML = '<i class="fas fa-redo"></i> Girar Novamente';
        }

    } catch (e) {
        console.error("Spin error:", e);
        isSpinning = false;
        alert("Erro ao iniciar roleta. Tente novamente.");
        document.getElementById('spinBtn').style.display = 'block';
    }
}

// ========== MANUAL CONFIRMATION ==========
async function confirmManualDraw() {
    const input = document.getElementById('manualWinnerInput');
    const number = input.value;

    if (!number) return alert('Digite o número sorteado!');

    if (!confirm(`TEM CERTEZA? Isso vai encerrar a rifa com o ganhador Nº ${number}.`)) return;

    try {
        const res = await fetch('/api/admin/close-draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drawn_number: number })
        });

        const data = await res.json();

        if (res.ok) {
            alert(`✅ Sorteio finalizado! Ganhador definido: ${number}`);
            input.value = '';
            loadStats(); // Reload to show inactive state
            loadWinnersHistory(); // Update history
        } else {
            alert(`Erro: ${data.error}`);
        }
    } catch (e) {
        alert('Erro de conexão ao finalizar sorteio.');
        console.error(e);
    }
}



// Set default dates on load
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const fmtDate = d => d.toISOString().split('T')[0];

    // Only set if elements exist (admin page)
    const startInp = document.getElementById('finStartDate');
    const endInp = document.getElementById('finEndDate');

    if (startInp && endInp) {
        startInp.value = fmtDate(firstDay);
        endInp.value = fmtDate(today);
    }
});
