/**
 * Share Landing Page - Sequential Flow Logic
 * 
 * Uses Web Share API to trigger native sharing on mobile.
 * Reveals the group button after the share dialog is closed.
 * Includes countdown timer to 21:00 Brasília time.
 */

// Configuration - Customize these values
const SHARE_CONFIG = {
    text: `🚨 R$450 PIX DE NATAL 🚨

Todos participam
Só recebe quem compartilhar esse aviso no status do WhatsApp HOJE

Não compartilhou?
Se ganhar, perde.

👉 Entre agora: https://www.tvzapao.com.br/share.html`,
    groupLink: 'https://chat.whatsapp.com/KX52zLyO8GIEY25qHo55T0',
    fallbackDelay: 3000 // 3 seconds delay for fallback
};

// Track if group button was already shown (persists in session)
let groupButtonRevealed = sessionStorage.getItem('groupRevealed') === 'true';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // If user already shared in this session, show the group button
    if (groupButtonRevealed) {
        showGroupButton(false); // No animation on page load
    }

    // Update group link from config
    const groupBtn = document.getElementById('groupButton');
    if (groupBtn) {
        groupBtn.href = SHARE_CONFIG.groupLink;
    }

    // Start countdown timer
    startCountdown();
});

/**
 * Countdown timer to 21:00 Brasília time
 */
function startCountdown() {
    const timerDisplay = document.getElementById('countdownTimer');
    if (!timerDisplay) return;

    function updateTimer() {
        // Get current time in Brasília timezone (UTC-3)
        const now = new Date();
        const brasiliaOffset = -3 * 60; // UTC-3 in minutes
        const localOffset = now.getTimezoneOffset();
        const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60000);

        // Target: 21:00 today (or tomorrow if past 21:00)
        let target = new Date(brasiliaTime);
        target.setHours(21, 0, 0, 0);

        // If it's past 21:00, target is tomorrow
        if (brasiliaTime >= target) {
            target.setDate(target.getDate() + 1);
        }

        // Calculate difference
        const diff = target - brasiliaTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Format display
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        const secondsStr = String(seconds).padStart(2, '0');

        timerDisplay.innerHTML = `
            <span class="timer-value">${hoursStr}</span>
            <span class="timer-separator">:</span>
            <span class="timer-value">${minutesStr}</span>
            <span class="timer-separator">:</span>
            <span class="timer-value">${secondsStr}</span>
        `;
    }

    // Update immediately and then every second
    updateTimer();
    setInterval(updateTimer, 1000);

    // Scroll shake animation
    let lastScrollY = 0;
    const timerRow = document.getElementById('timerRow');

    window.addEventListener('scroll', () => {
        if (timerRow && Math.abs(window.scrollY - lastScrollY) > 30) {
            timerRow.classList.add('shake');
            setTimeout(() => timerRow.classList.remove('shake'), 500);
            lastScrollY = window.scrollY;
        }
    }, { passive: true });
}

/**
 * Main share function - Compartilha VÍDEO + texto
 */
async function shareToStatus() {
    const shareButton = document.getElementById('shareButton');

    // Disable button to prevent double-clicks
    shareButton.disabled = true;
    shareButton.innerHTML = '<span class="icon">⏳</span><span>Preparando...</span>';
    shareButton.classList.remove('pulse');

    // Check if Web Share API is supported
    if (navigator.share) {
        try {
            // Buscar o vídeo
            const videoResp = await fetch('/video-compartilhamento.mp4');
            const videoBlob = await videoResp.blob();
            const videoFile = new File([videoBlob], 'sorteio.mp4', { type: 'video/mp4' });

            // Tentar compartilhar vídeo primeiro
            try {
                await navigator.share({
                    files: [videoFile],
                    text: 'https://www.tvzapao.com.br/share.html'
                });
                console.log('Vídeo compartilhado com sucesso');
            } catch (videoError) {
                // Se vídeo falhar, compartilhar só o link
                console.log('Vídeo não suportado, compartilhando link:', videoError.message);
                await navigator.share({
                    text: 'https://www.tvzapao.com.br/share.html'
                });
            }

        } catch (error) {
            console.log('Share cancelled or failed:', error.message);
        } finally {
            showGroupButton(true);
        }
    } else {
        // Fallback: Open WhatsApp directly
        fallbackToWhatsApp();
    }
}

/**
 * Fallback for browsers that don't support Web Share API
 * Opens WhatsApp directly with the message text
 */
function fallbackToWhatsApp() {
    const encodedText = encodeURIComponent(SHARE_CONFIG.text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');

    // Show group button after delay
    setTimeout(() => {
        showGroupButton(true);
    }, SHARE_CONFIG.fallbackDelay);
}

/**
 * Show the group button with animation
 */
function showGroupButton(animate = true) {
    const step1 = document.getElementById('step1Wrapper');
    const divider = document.getElementById('stepDivider');
    const step2 = document.getElementById('step2Wrapper');
    const infoTip = document.getElementById('infoTip');
    const shareButton = document.getElementById('shareButton');

    // Mark as revealed for this session
    groupButtonRevealed = true;
    sessionStorage.setItem('groupRevealed', 'true');

    // Update share button to "shared" state
    if (shareButton) {
        shareButton.disabled = false;
        shareButton.innerHTML = '<span class="icon">✅</span><span>Compartilhado!</span>';
        shareButton.classList.add('shared');
    }

    // Show divider and step 2
    if (divider) divider.classList.remove('hidden');
    if (step2) step2.classList.remove('hidden');
    if (infoTip) infoTip.classList.add('hidden');

    if (animate && step2) {
        // Removido scrollIntoView para evitar efeito estilingue
        step2.classList.add('fade-in');
    }
}
