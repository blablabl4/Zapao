/**
 * Share Landing Page - Sequential Flow Logic
 * 
 * Uses Web Share API to trigger native sharing on mobile.
 * Reveals the group button after the share dialog is closed.
 */

// Configuration - Customize these values
const SHARE_CONFIG = {
    title: '🎄 R$450 SALVA SEU NATAL?',
    text: '🎰 SORTEIO GRATUITO HOJE ÀS 21H!\n\n✅ Entre no grupo\n✅ Compartilhe essa imagem no status\n\n⚠️ Quem compartilha, continua no sorteio\n❌ Não compartilhou? Perde!\n\n👇 Entre no grupo e compartilhe:',
    url: window.location.origin + '/share.html',
    imageUrl: '/images/share-promo.jpg',
    groupLink: 'https://taggo.one/amigosdozapao',
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
});

/**
 * Main share function - triggers Web Share API or fallback
 * Tries to share with image file when supported
 */
async function shareToStatus() {
    const shareButton = document.getElementById('shareButton');

    // Disable button to prevent double-clicks
    shareButton.disabled = true;
    shareButton.innerHTML = '<span class="icon">⏳</span><span>Abrindo...</span>';
    shareButton.classList.remove('pulse');

    // Check if Web Share API is supported
    if (navigator.share) {
        try {
            // Try to share with image file first
            const shareData = await prepareShareData();
            await navigator.share(shareData);

            console.log('Share completed successfully');

        } catch (error) {
            // User cancelled or error occurred
            console.log('Share cancelled or failed:', error.message);
        } finally {
            // Always show the group button when returning to the page
            showGroupButton(true);
            resetShareButton();
        }
    } else {
        // Fallback for browsers without Web Share API
        console.log('Web Share API not supported, using fallback');
        openWhatsAppFallback();

        // Show group button after delay
        setTimeout(() => {
            showGroupButton(true);
            resetShareButton();
        }, SHARE_CONFIG.fallbackDelay);
    }
}

/**
 * Prepares the share data, attempting to include the image file
 */
async function prepareShareData() {
    const baseShareData = {
        title: SHARE_CONFIG.title,
        text: SHARE_CONFIG.text,
        url: SHARE_CONFIG.url
    };

    // Try to fetch and include the image for sharing
    try {
        const response = await fetch(SHARE_CONFIG.imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'sorteio-natal.jpg', { type: 'image/jpeg' });

        // Check if sharing with files is supported
        const shareDataWithFile = {
            ...baseShareData,
            files: [file]
        };

        if (navigator.canShare && navigator.canShare(shareDataWithFile)) {
            console.log('Sharing with image file');
            return shareDataWithFile;
        }
    } catch (error) {
        console.log('Could not include image:', error.message);
    }

    // Fallback to text-only sharing
    console.log('Sharing text only');
    return baseShareData;
}

/**
 * Shows the group button with optional animation
 * @param {boolean} animate - Whether to play fade-in animation
 */
function showGroupButton(animate = true) {
    const step2Wrapper = document.getElementById('step2Wrapper');
    const stepDivider = document.getElementById('stepDivider');
    const infoTip = document.getElementById('infoTip');
    const shareButton = document.getElementById('shareButton');

    // Mark as revealed
    groupButtonRevealed = true;
    sessionStorage.setItem('groupRevealed', 'true');

    // Update share button to show it's complete
    shareButton.innerHTML = '<span class="icon">✅</span><span>Compartilhado!</span>';
    shareButton.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    shareButton.classList.remove('pulse');
    shareButton.disabled = true;

    // Hide info tip
    if (infoTip) {
        infoTip.style.display = 'none';
    }

    // Show the divider and step 2
    stepDivider.classList.remove('hidden');
    step2Wrapper.classList.remove('hidden');

    // Apply animation if requested
    if (animate) {
        stepDivider.classList.add('fade-in');
        step2Wrapper.classList.add('fade-in');
    }

    // Scroll to make sure the button is visible
    setTimeout(() => {
        step2Wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

/**
 * Resets the share button state (keeps it as completed if already shared)
 */
function resetShareButton() {
    const shareButton = document.getElementById('shareButton');

    if (groupButtonRevealed) {
        // Keep it in completed state
        shareButton.innerHTML = '<span class="icon">✅</span><span>Compartilhado!</span>';
        shareButton.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        shareButton.disabled = true;
    } else {
        // Reset to original state
        shareButton.innerHTML = '<span class="icon">📤</span><span>Compartilhar no Status</span>';
        shareButton.style.background = '';
        shareButton.disabled = false;
        shareButton.classList.add('pulse');
    }
}

/**
 * Fallback: Opens WhatsApp with pre-filled message
 * Used when Web Share API is not available
 */
function openWhatsAppFallback() {
    const message = encodeURIComponent(
        `${SHARE_CONFIG.title}\n\n${SHARE_CONFIG.text}\n\n${SHARE_CONFIG.url}`
    );

    // Try WhatsApp app first, fallback to web
    const whatsappUrl = `https://api.whatsapp.com/send?text=${message}`;

    // Open in new tab/window
    window.open(whatsappUrl, '_blank');
}

/**
 * Utility: Reset everything (for testing)
 */
function resetShareFlow() {
    sessionStorage.removeItem('groupRevealed');
    groupButtonRevealed = false;

    const step2Wrapper = document.getElementById('step2Wrapper');
    const stepDivider = document.getElementById('stepDivider');
    const infoTip = document.getElementById('infoTip');

    step2Wrapper.classList.add('hidden');
    step2Wrapper.classList.remove('fade-in');
    stepDivider.classList.add('hidden');
    stepDivider.classList.remove('fade-in');

    if (infoTip) {
        infoTip.style.display = 'block';
    }

    resetShareButton();

    console.log('Share flow reset');
}

// Expose reset function globally for testing
window.resetShareFlow = resetShareFlow;
