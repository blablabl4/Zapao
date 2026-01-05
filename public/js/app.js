// Core Application Logic (API, Stats, Modal Handling)
// Visual rendering is now handled by page-specific scripts (e.g., zapao-da-sorte.html)

let currentStats = { paid_count_by_number: [] };
let currentOrderId = null;
let pollingInterval = null;
let expirationInterval = null;
let buyerData = null;
let salesLocked = false;

// Initialize shared logic
document.addEventListener('DOMContentLoaded', () => {
    // Only load data/stats and init forms. Visuals are handled by the page.
    loadStats();
    startPolling();
    loadSavedBuyerData();
    initFormValidation();
});

/**
 * Initialize form validation and masks
 */
function initFormValidation() {
    // Set max date for birthdate (must be at least 18 years old)
    // Note: If fields are hidden/removed in HTML, this won't crash, just setting property on null check
    const birthInput = document.getElementById('buyerBirthdate');
    if (birthInput) {
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        birthInput.max = maxDate.toISOString().split('T')[0];
    }

    // Phone mask
    const phoneInput = document.getElementById('buyerPhone');
    if (phoneInput) {
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
}

/**
 * Load saved buyer data from localStorage
 */
function loadSavedBuyerData() {
    const saved = localStorage.getItem('buyerData');
    if (saved) {
        try {
            buyerData = JSON.parse(saved);
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

        if (prizeDisplay) prizeDisplay.textContent = `R$ ${drawStats.current_draw.current_prize.toFixed(2)}`;

        if (reinforcedBadge) {
            if (drawStats.current_draw.is_reinforced) {
                reinforcedBadge.innerHTML = '<span class="reinforced-badge">🔥 Prêmio Reforçado!</span>';
            } else {
                reinforcedBadge.innerHTML = '';
            }
        }

        // Check sales lock
        salesLocked = drawStats.current_draw.sales_locked || false;

        if (salesStatus) {
            if (salesLocked) {
                salesStatus.innerHTML = '<div class="sales-locked-message">🔒 Vendas encerradas! O sorteio acontecerá em breve.</div>';
            } else {
                salesStatus.innerHTML = '';
            }
        }

        // AFFILIATE LOGIC: Capture Ref
        const urlParams = new URLSearchParams(window.location.search);
        const refParam = urlParams.get('ref');
        if (refParam) {
            // Store with current Draw ID to ensure validity scope
            const affiliateData = {
                code: refParam,
                drawId: drawStats.current_draw.id
            };
            localStorage.setItem('affiliateData', JSON.stringify(affiliateData));
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
        const nameInput = document.getElementById('buyerName');
        const birthInput = document.getElementById('buyerBirthdate');
        const genderInput = document.getElementById('buyerGender');

        if (nameInput) nameInput.value = found.name || '';
        if (birthInput) birthInput.value = found.birthdate || '';
        if (genderInput) genderInput.value = found.gender || '';

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
    const nameInput = document.getElementById('buyerName');
    const phoneInput = document.getElementById('buyerPhone');
    const birthInput = document.getElementById('buyerBirthdate');
    const genderInput = document.getElementById('buyerGender');

    const data = {
        name: nameInput ? nameInput.value : '',
        phone: phoneInput ? phoneInput.value : '',
        birthdate: birthInput ? birthInput.value : '2000-01-01',
        gender: genderInput ? genderInput.value : 'O'
    };

    saveBuyerData(data);

    const numbersValue = document.getElementById('currentNumber').value;
    const numbers = numbersValue.split(',').map(n => parseInt(n.trim()));
    // Calculate total on server? Or client? The modal logic set the price text, but this function just sends numbers.
    // The backend knows the price.

    // Hide registration, show payment section
    document.getElementById('registrationSection').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'block';

    // Update Modal UI for Payment
    const numbersText = numbers.map(n => n.toString().padStart(2, '0')).join(', ');
    document.getElementById('modalNumber2').textContent = numbersText;
    // We don't recalculate amount here, assumed set by previous step

    // Show loading
    document.getElementById('loadingSection').style.display = 'block';
    document.getElementById('pixSection').style.display = 'none';
    document.getElementById('modalStatus').textContent = 'Gerando Pix...';
    document.getElementById('modalStatus').className = 'status-badge status-pending';

    try {
        const buyer_ref = `${data.name}|${data.phone}|${data.birthdate}|${data.gender}`;

        // AFFILIATE LOGIC: Retrieve valid ref
        let referrer_id = null;
        const storedAffiliate = localStorage.getItem('affiliateData');
        if (storedAffiliate) {
            try {
                const aff = JSON.parse(storedAffiliate);
                // Validate if it belongs to CURRENT draw
                // Note: currentStats is updated by loadStats. We need to be sure it's loaded.
                if (currentStats && currentStats.current_draw && currentStats.current_draw.id === aff.drawId) {
                    referrer_id = aff.code;
                }
            } catch (e) { console.error('Error parsing affiliate data', e); }
        }

        // Call bulk order endpoint
        const response = await fetch('/api/orders/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers, buyer_ref, referrer_id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao criar pedidos');
        }

        const result = await response.json();

        // Store combined order ID for polling
        currentOrderId = result.combined_order_id;
        document.getElementById('currentOrderId').value = result.combined_order_id;

        // Display Pix data
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

function startExpirationTimer(expiresAt) {
    const expiresDate = new Date(expiresAt);

    expirationInterval = setInterval(() => {
        const now = new Date();
        const diff = expiresDate - now;

        if (diff <= 0) {
            document.getElementById('expiresTimer').innerHTML = '<strong style="color: var(--warning);">⏰ Expirado</strong>';
            clearInterval(expirationInterval);
            const mockBtn = document.getElementById('mockPayBtn');
            if (mockBtn) mockBtn.disabled = true;
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

                // Generate Affiliate Link (Indicação Premiada)
                if (buyerData && buyerData.phone && currentStats.current_draw) {
                    // Create code: Phone-DrawID (Base64)
                    const rawCode = `${buyerData.phone}-${currentStats.current_draw.id}`;
                    const shareCode = btoa(rawCode);
                    const shareLink = `${window.location.origin}${window.location.pathname}?ref=${shareCode}`;

                    // Create UI Container
                    const successSection = document.getElementById('successSection');
                    let shareContainer = document.getElementById('shareContainer');
                    if (!shareContainer) {
                        shareContainer = document.createElement('div');
                        shareContainer.id = 'shareContainer';
                        shareContainer.style.marginTop = '20px';
                        shareContainer.style.textAlign = 'center';
                        shareContainer.style.padding = '15px';
                        shareContainer.style.background = 'rgba(255, 215, 0, 0.1)';
                        shareContainer.style.borderRadius = '10px';
                        shareContainer.style.border = '1px solid #FFD700';
                        successSection.appendChild(shareContainer);
                    }

                    shareContainer.innerHTML = `
                        <h3 style="color: #FFD700; margin-bottom: 10px;">🌟 Indicação Premiada!</h3>
                        <p style="color: #fff; font-size: 0.9em; margin-bottom: 10px;">
                            Compartilhe seu link da sorte. Se alguém ganhar através dele, você ganha também!
                        </p>
                        <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px;">
                            <input type="text" value="${shareLink}" readonly 
                                style="width: 100%; padding: 10px; border-radius: 5px; border: none; background: #333; color: #fff; font-size: 0.8em;">
                            <button onclick="navigator.clipboard.writeText('${shareLink}').then(() => alert('Link copiado!'))" 
                                style="background: #28a745; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">
                                📋
                            </button>
                        </div>
                        <a href="https://wa.me/?text=${encodeURIComponent('Compre sua rifa com meu link da sorte para ganharmos juntos! ' + shareLink)}" 
                           target="_blank" 
                           style="background: #25D366; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; font-weight: bold;">
                           📲 Enviar no WhatsApp
                        </a>
                    `;
                }
            } else if (order.status === 'EXPIRED') {
                document.getElementById('modalStatus').textContent = '⏰ Pedido expirado';
                document.getElementById('modalStatus').className = 'status-badge status-expired';
                const mockBtn = document.getElementById('mockPayBtn');
                if (mockBtn) mockBtn.disabled = true;
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
    // Try scrolling to new grid ID first
    const newGrid = document.querySelector('.zapao-grid-container');
    if (newGrid) {
        newGrid.scrollIntoView({ behavior: 'smooth' });
    } else {
        const oldGrid = document.querySelector('.numbers-grid');
        if (oldGrid) oldGrid.scrollIntoView({ behavior: 'smooth' });
    }
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

    // Page-specific cleanup handled by page script usually, 
    // but app.js doesn't know about `selectedNumbers` array of the page.
    // The PAGE script should listen or handle UI reset.
    // However, for compatibility, we reset form fields here.

    document.getElementById('currentOrderId').value = '';

    // Reset Sections
    document.getElementById('registrationSection').style.display = 'block';
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
}

