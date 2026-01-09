/**
 * Share Popup - Shows as modal on homepage for direct visitors
 * 
 * Logic:
 * - If user has already shared (sessionStorage), don't show
 * - If user came from /share page, don't show (they already saw it)
 * - Otherwise, show popup asking to share
 */

const SHARE_POPUP_CONFIG = {
    title: '🎄 R$450 SALVA SEU NATAL?',
    text: '🎰 SORTEIO GRATUITO HOJE ÀS 21H!\n\n✅ Entre no grupo\n✅ Compartilhe essa imagem no status\n\n⚠️ Quem compartilha, continua no sorteio\n❌ Não compartilhou? Perde!\n\n👇 Entre no grupo e compartilhe:',
    url: window.location.origin + '/share.html',
    imageUrl: '/images/share-promo.jpg',
    groupLink: 'https://chat.whatsapp.com/KVfNKMR7W1lGMtMSWtN5W3'
};

// Check if popup should be shown
function shouldShowSharePopup() {
    // Already shared in this session
    if (sessionStorage.getItem('sharePopupCompleted') === 'true') {
        return false;
    }

    // Already dismissed the popup
    if (sessionStorage.getItem('sharePopupDismissed') === 'true') {
        return false;
    }

    // Came from share page (already saw the full page)
    if (sessionStorage.getItem('groupRevealed') === 'true') {
        return false;
    }

    // Check referrer - if from share page, don't show
    if (document.referrer.includes('/share')) {
        sessionStorage.setItem('sharePopupCompleted', 'true');
        return false;
    }

    return true;
}

// Initialize popup on page load
document.addEventListener('DOMContentLoaded', () => {
    if (shouldShowSharePopup()) {
        // Small delay for better UX
        setTimeout(showSharePopup, 500);
    }
});

// Show the share popup
function showSharePopup() {
    const popup = document.getElementById('sharePopupModal');
    if (popup) {
        popup.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scroll
    }
}

// Close the popup (dismiss)
function closeSharePopup() {
    const popup = document.getElementById('sharePopupModal');
    if (popup) {
        popup.classList.remove('active');
        document.body.style.overflow = '';
    }
    sessionStorage.setItem('sharePopupDismissed', 'true');
}

// Share and close popup
async function shareFromPopup() {
    const shareButton = document.getElementById('popupShareButton');

    // Update button state
    shareButton.disabled = true;
    shareButton.innerHTML = '<span class="icon">⏳</span><span>Abrindo...</span>';

    if (navigator.share) {
        try {
            const shareData = await preparePopupShareData();
            await navigator.share(shareData);
            console.log('Share completed');
        } catch (error) {
            console.log('Share cancelled:', error.message);
        } finally {
            completeSharePopup();
        }
    } else {
        // Fallback - open WhatsApp
        openWhatsAppPopupFallback();
        setTimeout(completeSharePopup, 3000);
    }
}

// Prepare share data with image
async function preparePopupShareData() {
    const baseData = {
        title: SHARE_POPUP_CONFIG.title,
        text: SHARE_POPUP_CONFIG.text,
        url: SHARE_POPUP_CONFIG.url
    };

    try {
        const response = await fetch(SHARE_POPUP_CONFIG.imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'sorteio-natal.jpg', { type: 'image/jpeg' });

        const shareDataWithFile = { ...baseData, files: [file] };

        if (navigator.canShare && navigator.canShare(shareDataWithFile)) {
            return shareDataWithFile;
        }
    } catch (e) {
        console.log('Could not include image:', e);
    }

    return baseData;
}

// WhatsApp fallback
function openWhatsAppPopupFallback() {
    const message = encodeURIComponent(
        `${SHARE_POPUP_CONFIG.title}\n\n${SHARE_POPUP_CONFIG.text}\n\n${SHARE_POPUP_CONFIG.url}`
    );
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
}

// Complete the share flow
function completeSharePopup() {
    sessionStorage.setItem('sharePopupCompleted', 'true');
    sessionStorage.setItem('groupRevealed', 'true');

    const popup = document.getElementById('sharePopupModal');
    if (popup) {
        popup.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Show success toast
    showShareSuccessToast();
}

// Show success toast notification
function showShareSuccessToast() {
    const toast = document.createElement('div');
    toast.className = 'share-success-toast';
    toast.innerHTML = '✅ Obrigado por compartilhar! Boa sorte no sorteio!';
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('visible');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
