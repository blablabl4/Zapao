// zapao-logic.js - Specialized Logic for Zapão da Sorte (0-99)
// Independent of app.js for visual rendering

const ZAPAO_CONFIG = {
    totalNumbers: 100,
    price: 1.50,
    gridId: 'zapaoGrid',
    floatingBtnContainerId: 'floatingDivHost'
};

let selectedNumbers = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Zapão] Initializing independent logic...');

    // 1. Render Grid
    renderZapaoGrid();

    // 2. Create Floating Button (Hidden initially)
    createZapaoFloatingButton();
});

function renderZapaoGrid() {
    const grid = document.getElementById(ZAPAO_CONFIG.gridId);
    if (!grid) {
        console.error('[Zapão] Grid container not found:', ZAPAO_CONFIG.gridId);
        return;
    }

    grid.innerHTML = ''; // Clear anything existing

    for (let i = 0; i < ZAPAO_CONFIG.totalNumbers; i++) {
        const numStr = i.toString().padStart(2, '0');
        const btn = document.createElement('div');

        // CSS Classes from styles.css
        btn.className = 'number-btn';
        btn.textContent = numStr;
        btn.id = `zbtn-${i}`; // Unique ID to avoid conflicts

        // Click Handler
        btn.onclick = () => toggleZapaoNumber(i, btn);

        grid.appendChild(btn);
    }
    console.log(`[Zapão] Rendered ${ZAPAO_CONFIG.totalNumbers} numbers.`);
}

function toggleZapaoNumber(num, el) {
    if (el.classList.contains('taken')) return;

    // Toggle logic
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        // Remove from array
        selectedNumbers = selectedNumbers.filter(n => n !== num);
    } else {
        el.classList.add('selected');
        // Add to array (Unlimited)
        selectedNumbers.push(num);
    }

    updateZapaoFloatingButton();
}

function createZapaoFloatingButton() {
    const container = document.getElementById(ZAPAO_CONFIG.floatingBtnContainerId);
    if (!container) return; // Should exist in HTML

    const btn = document.createElement('button');
    btn.id = 'zapaoFloatBtn';
    btn.className = 'floating-buy-btn'; // Reusing style
    btn.style.display = 'none';
    btn.onclick = openZapaoCheckout;

    container.appendChild(btn);
}

function updateZapaoFloatingButton() {
    const btn = document.getElementById('zapaoFloatBtn');
    if (!btn) return;

    if (selectedNumbers.length > 0) {
        const count = selectedNumbers.length;
        const total = count * ZAPAO_CONFIG.price;
        btn.innerHTML = `🛒 Comprar ${count} (R$ ${total.toFixed(2)})`;
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
}

function openZapaoCheckout() {
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    modal.classList.add('active');

    // Populate Modal Data
    const sorted = selectedNumbers.sort((a, b) => a - b);
    const numbersList = sorted.join(', ');
    const total = sorted.length * ZAPAO_CONFIG.price;

    // Update Text Elements
    const numDisplay = document.getElementById('modalNumber');
    if (numDisplay) numDisplay.textContent = numbersList.length > 25 ? numbersList.substring(0, 25) + '...' : numbersList;

    const amtDisplay = document.getElementById('modalAmount');
    if (amtDisplay) amtDisplay.textContent = `R$ ${total.toFixed(2)}`;

    // Set Hidden Input for Form Submission (App.js reads this!)
    const hiddenInput = document.getElementById('currentNumber');
    if (hiddenInput) hiddenInput.value = sorted.join(',');

    // Reset UI State
    const regSection = document.getElementById('registrationSection');
    const paySection = document.getElementById('paymentSection');
    const sucSection = document.getElementById('successSection');

    if (regSection) regSection.style.display = 'block';
    if (paySection) paySection.style.display = 'none';
    if (sucSection) sucSection.style.display = 'none';
}

// Expose reset for app.js if needed
window.resetZapaoSelection = function () {
    selectedNumbers = [];
    document.querySelectorAll('.number-btn.selected').forEach(el => el.classList.remove('selected'));
    updateZapaoFloatingButton();
};
