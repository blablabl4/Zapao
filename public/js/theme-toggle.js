/**
 * Theme Toggle - Dark/Light Mode
 * Handles theme switching with system preference detection
 */

// Theme constants
const THEME_KEY = 'tvzapao-theme';
const DARK = 'dark';
const LIGHT = 'light';

// Get current theme
function getTheme() {
    // Check localStorage first
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return LIGHT;
    }

    return DARK; // Default to dark
}

// Apply theme to document
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update toggle button icon
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = theme === DARK ? '☀️' : '🌙';
        toggleBtn.setAttribute('aria-label', theme === DARK ? 'Mudar para modo claro' : 'Mudar para modo escuro');
    }

    // Save preference
    localStorage.setItem(THEME_KEY, theme);
}

// Toggle between themes
function toggleTheme() {
    const current = getTheme();
    const next = current === DARK ? LIGHT : DARK;
    applyTheme(next);

    // Add a small animation effect
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme());

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(THEME_KEY)) {
                applyTheme(e.matches ? DARK : LIGHT);
            }
        });
    }
});

// Apply immediately to prevent flash
applyTheme(getTheme());
