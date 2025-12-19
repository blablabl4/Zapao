let currentStats = { paid_count_by_number: [] };
let currentOrderId = null;
let pollingInterval = null;
let expirationInterval = null;
let buyerData = null;
let salesLocked = false;

// Multi-number selection state
let selectedNumbers = [];
const MAX_SELECTION = 3;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    renderGrid();
    loadStats();
    startPolling();
    loadSavedBuyerData();
    initFormValidation();
    createFloatingButton();
});

/**
 * Create floating buy button
 */
function createFloatingButton() {
    const btn = document.createElement('button');
    btn.id = 'floatingBuyBtn';
    btn.className = 'floating-buy-btn';
    btn.style.display = 'none';
    btn.onclick = openCheckoutModal;
    document.body.appendChild(btn);
}

/**
 * Update floating button visibility and text
 */
function updateFloatingButton() {
    const btn = document.getElementById('floatingBuyBtn');

    if (selectedNumbers.length > 0) {
        const count = selectedNumbers.length;
        const total = count * 1.00;
        btn.innerHTML = `🛒 Comprar ${count} número${count > 1 ? 's' : ''} - R$ ${total.toFixed(2)}`;
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
}

/**
 * Toggle number selection
 */
function toggleNumberSelection(number) {
    const btn = document.getElementById(`btn-${number}`);

    if (selectedNumbers.includes(number)) {
        // Deselect
        selectedNumbers = selectedNumbers.filter(n => n !== number);
        btn.classList.remove('selected');
    } else {
        // Check limit
        if (selectedNumbers.length >= MAX_SELECTION) {
            alert(`Máximo de ${MAX_SELECTION} números por vez!`);
            return;
        }
        // Select
        selectedNumbers.push(number);
        btn.classList.add('selected');
    }

    updateFloatingButton();
}

/**
 * Open checkout modal for selected numbers
 */
function openCheckoutModal() {
    if (selectedNumbers.length === 0) {
        alert('Selecione pelo menos 1 número');
        return;
    }

    // Disable grid during checkout
    disableGrid(true);

    // Show modal
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('active');

    // Set numbers and amount
    const total = selectedNumbers.length * 1.00;
    const numbersText = selectedNumbers.map(n => n.toString().padStart(2, '0')).join(', ');

    document.getElementById('modalNumber').textContent = numbersText;
    document.getElementById('modalAmount').textContent = `R$ ${total.toFixed(2)}`;
    document.getElementById('currentNumber').value = selectedNumbers.join(',');

    // Show registration section
    document.getElementById('registrationSection').style.display = 'block';
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';

    // Clear form
    document.getElementById('registrationForm').reset();

    // Pre-fill if we have saved data
    if (buyerData) {
        document.getElementById('buyerName').value = buyerData.name || '';
        document.getElementById('buyerPhone').value = buyerData.phone || '';
        document.getElementById('buyerBirthdate').value = buyerData.birthdate || '';
        document.getElementById('buyerGender').value = buyerData.gender || '';
    }
}

/**
 * Initialize form validation and masks
 */
function initFormValidation() {
    // Set max date for birthdate (must be at least 18 years old)
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    document.getElementById('buyerBirthdate').max = maxDate.toISOString().split('T')[0];

    // Phone mask
    const phoneInput = document.getElementById('buyerPhone');
    phoneInput.addEventListener('input', function (e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 6) {
            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
        } else if (value.length > 2) {
            value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        } else if (value.length > 0) {
            value = `(${value}`;
        }

        e.target.value = value;
    });
}

/**
 * Load saved buyer data from localStorage
 */
function loadSavedBuyerData() {
    const saved = localStorage.getItem('buyerData');
    if (saved) {
        try {
            buyerData = JSON.parse(saved);
            console.log('[LocalStorage] Loaded buyer data');
        } catch (e) {
            console.error('Error loading buyer data:', e);
        }
    }
}

/**
 * Save buyer data to localStorage
 */
function saveBuyerData(data) {
    buyerData = data;
    localStorage.setItem('buyerData', JSON.stringify(data));
    console.log('[LocalStorage] Saved buyer data');
}

/**
 * Search buyer by phone in localStorage
 */
function searchBuyerByPhone(phone) {
    if (buyerData && buyerData.phone === phone) {
        return buyerData;
    }
    return null;
}

/**
 * Render the numbers grid in 2 columns (00-49 | 50-99)
 */
function renderGrid() {
    const grid1 = document.getElementById('numbersGrid1');
    const grid2 = document.getElementById('numbersGrid2');

    grid1.innerHTML = '';
    grid2.innerHTML = '';

    // First column: 0-49
    for (let i = 0; i < 50; i++) {
        const btn = createNumberButton(i);
        grid1.appendChild(btn);
    }

    // Second column: 50-99
    for (let i = 50; i < 100; i++) {
        const btn = createNumberButton(i);
        grid2.appendChild(btn);
    }
}

/**
 * Create a number button (for selection)
 */
function createNumberButton(i) {
    const btn = document.createElement('button');
    btn.className = 'number-btn';
    btn.textContent = i.toString().padStart(2, '0');
    btn.onclick = () => toggleNumberSelection(i);
    btn.id = `btn-${i}`;
    return btn;
}

/**
 * Load statistics from API
 */
async function loadStats() {
    try {
        const response = await fetch('/api/orders/stats/global');
        const stats = await response.json();
        currentStats = stats;

        // Load current draw info
        const drawResponse = await fetch('/api/admin/stats');
        const drawStats = await drawResponse.json();

        // Update prize display
        const prizeDisplay = document.getElementById('prizeDisplay');
        const reinforcedBadge = document.getElementById('reinforcedBadge');
        const salesStatus = document.getElementById('salesStatus');

        prizeDisplay.textContent = `R$ ${drawStats.current_draw.current_prize.toFixed(2)}`;

        if (drawStats.current_draw.is_reinforced) {
            reinforcedBadge.innerHTML = '<span class="reinforced-badge">🔥 Prêmio Reforçado!</span>';
        } else {
            reinforcedBadge.innerHTML = '';
        }

        // Check sales lock
        salesLocked = drawStats.current_draw.sales_locked || false;

        if (salesLocked) {
            salesStatus.innerHTML = '<div class="sales-locked-message">🔒 Vendas encerradas! O sorteio acontecerá em breve.</div>';
            disableGrid(true);
        } else {
            salesStatus.innerHTML = '';
            const modalOpen = document.getElementById('checkoutModal').classList.contains('active');
            if (!modalOpen) {
                disableGrid(false);
            }
        }

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Start polling for stats updates (every 2 seconds)
 */
function startPolling() {
    pollingInterval = setInterval(() => {
        loadStats();
    }, 2000);
}

/**
 * Stop polling
 */
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

/**
 * Search for buyer by phone
 */
function searchByPhone() {
    const phone = document.getElementById('buyerPhone').value.trim();
    if (!phone) {
        alert('Digite um celular para buscar');
        return;
    }

    const found = searchBuyerByPhone(phone);
    if (found) {
        document.getElementById('buyerName').value = found.name || '';
        document.getElementById('buyerBirthdate').value = found.birthdate || '';
        document.getElementById('buyerGender').value = found.gender || '';
        alert('✅ Dados encontrados!');
    } else {
        alert('Nenhum cadastro encontrado para este celular');
    }
}

/**
 * Submit registration and proceed to payment
 */
async function submitRegistration(event) {
    event.preventDefault();

    // Collect and save buyer data
    const data = {
        name: document.getElementById('buyerName').value,
        phone: document.getElementById('buyerPhone').value,
        birthdate: document.getElementById('buyerBirthdate').value,
        gender: document.getElementById('buyerGender').value
    };

    saveBuyerData(data);

    const numbersValue = document.getElementById('currentNumber').value;
    const numbers = numbersValue.split(',').map(n => parseInt(n.trim()));
    const total = numbers.length * 1.00;

    // Hide registration, show payment section
    document.getElementById('registrationSection').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'block';

    // Set numbers and amount in payment section
    const numbersText = numbers.map(n => n.toString().padStart(2, '0')).join(', ');
    document.getElementById('modalNumber2').textContent = numbersText;
    document.getElementById('modalAmount2').textContent = `R$ ${total.toFixed(2)}`;

    // Show loading
    document.getElementById('loadingSection').style.display = 'block';
    document.getElementById('pixSection').style.display = 'none';
    document.getElementById('modalStatus').textContent = 'Gerando Pix...';
    document.getElementById('modalStatus').className = 'status-badge status-pending';

    try {
        const buyer_ref = `${data.name}|${data.phone}|${data.birthdate}|${data.gender}`;

        // Call bulk order endpoint
        const response = await fetch('/api/orders/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers, buyer_ref })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao criar pedidos');
        }

        const result = await response.json();

        // Store combined order ID for polling
        currentOrderId = result.combined_order_id;
        document.getElementById('currentOrderId').value = result.combined_order_id;

        // Display Pix data (now with total amount)
        document.getElementById('qrImage').src = result.qr_image_data_url;
        document.getElementById('pixCopyPaste').value = result.pix_copy_paste;

        // Show Pix section
        document.getElementById('loadingSection').style.display = 'none';
        document.getElementById('pixSection').style.display = 'block';
        document.getElementById('modalStatus').textContent = 'Aguardando pagamento';

        // Start expiration timer
        startExpirationTimer(result.expires_at);

        // Start checking order status (check first order)
        const firstOrderId = result.orders[0].order_id;
        startOrderStatusPolling(firstOrderId);

    } catch (error) {
        console.error('Error creating order:', error);
        alert(error.message || 'Erro ao gerar Pix. Tente novamente.');
        closeModal();
    }
}

// Rest of functions unchanged...
function startExpirationTimer(expiresAt) {
    const expiresDate = new Date(expiresAt);

    expirationInterval = setInterval(() => {
        const now = new Date();
        const diff = expiresDate - now;

        if (diff <= 0) {
            document.getElementById('expiresTimer').innerHTML = '<strong style="color: var(--warning);">⏰ Expirado</strong>';
            clearInterval(expirationInterval);
            document.getElementById('mockPayBtn').disabled = true;
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        document.getElementById('expiresTimer').textContent = `Expira em: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function startOrderStatusPolling(orderId) {
    const checkStatus = async () => {
        try {
            const response = await fetch(`/api/orders/${orderId}`);
            const order = await response.json();

            if (order.status === 'PAID') {
                document.getElementById('paymentSection').style.display = 'none';
                document.getElementById('successSection').style.display = 'block';

                const numbersValue = document.getElementById('currentNumber').value;
                const numbers = numbersValue.split(',').map(n => parseInt(n.trim()));
                const numbersText = numbers.map(n => n.toString().padStart(2, '0')).join(', ');

                document.getElementById('successNumber').textContent = numbersText;

                if (window.currentStatusInterval) {
                    clearInterval(window.currentStatusInterval);
                    window.currentStatusInterval = null;
                }

                await loadStats();

            } else if (order.status === 'EXPIRED') {
                document.getElementById('modalStatus').textContent = '⏰ Pedido expirado';
                document.getElementById('modalStatus').className = 'status-badge status-expired';
                document.getElementById('mockPayBtn').disabled = true;
            }
        } catch (error) {
            console.error('Error checking order status:', error);
        }
    };

    const statusInterval = setInterval(checkStatus, 2000);
    window.currentStatusInterval = statusInterval;
}

function copyPixCode() {
    const textarea = document.getElementById('pixCopyPaste');
    textarea.select();
    document.execCommand('copy');
    alert('Código Pix copiado!');
}

async function simulatePayment() {
    const orderId = document.getElementById('currentOrderId').value;

    try {
        const response = await fetch(`/api/mock/pay/${orderId}`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            console.log('Payment simulated successfully');
        } else {
            alert(result.message || 'Erro ao simular pagamento');
        }
    } catch (error) {
        console.error('Error simulating payment:', error);
        alert('Erro ao simular pagamento');
    }
}

function buyAnother() {
    closeModal();
    document.querySelector('.numbers-grid').scrollIntoView({ behavior: 'smooth' });
}

function closeModal() {
    const modal = document.getElementById('checkoutModal');
    modal.classList.remove('active');

    if (expirationInterval) {
        clearInterval(expirationInterval);
        expirationInterval = null;
    }

    if (window.currentStatusInterval) {
        clearInterval(window.currentStatusInterval);
        window.currentStatusInterval = null;
    }

    // Clear selection
    selectedNumbers.forEach(num => {
        const btn = document.getElementById(`btn-${num}`);
        if (btn) btn.classList.remove('selected');
    });
    selectedNumbers = [];
    updateFloatingButton();

    if (!salesLocked) {
        disableGrid(false);
    }

    currentOrderId = null;
    document.getElementById('currentOrderId').value = '';
    document.getElementById('currentNumber').value = '';

    document.getElementById('registrationSection').style.display = 'block';
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
}

function disableGrid(disabled) {
    const buttons = document.querySelectorAll('.number-btn');
    buttons.forEach(btn => {
        btn.disabled = disabled;
    });
}
