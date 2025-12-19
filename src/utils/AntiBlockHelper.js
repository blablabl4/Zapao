/**
 * Anti-Fraud Obfuscation Helper
 * Diversifies payment descriptions and amounts to avoid pattern detection
 */

class AntiBlockHelper {
    constructor() {
        // Rotating descriptions for payments
        this.descriptions = [
            "TVZapão - Participação Premium",
            "TVZapão - Jogo Digital",
            "TVZapão - Entretenimento Online",
            "TVZapão - Concurso Numérico",
            "TVZapão - Desafio Premium",
            "TVZapão - Game Show Digital",
            "TVZapão - Experiência Interativa"
        ];

        this.descriptionIndex = 0;
    }

    /**
     * Get next rotating description
     * @returns {string} Rotated description
     */
    getRotatingDescription() {
        const description = this.descriptions[this.descriptionIndex];
        this.descriptionIndex = (this.descriptionIndex + 1) % this.descriptions.length;
        return description;
    }

    /**
     * Add small random variance to amount (0-5 cents)
     * This makes transactions look less uniform
     * @param {number} baseAmount - Base amount in BRL
     * @returns {number} Amount with small variance
     */
    addAmountVariance(baseAmount) {
        const randomCents = Math.floor(Math.random() * 6); // 0-5 cents
        return baseAmount + (randomCents / 100);
    }

    /**
     * Generate obfuscated order NSU
     * Format: ENT{timestamp}{random}
     * @returns {string} Obfuscated order NSU
     */
    generateObfuscatedOrderNsu() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `ENT${timestamp}${random}`;
    }

    /**
     * Get description for specific numbers
     * Includes number info but in "entertainment" context
     * @param {Array<number>} numbers - Selected numbers
     * @returns {string} Entertainment-focused description
     */
    getNumberDescription(numbers) {
        if (numbers.length === 1) {
            return `TVZapão - Jogo #${numbers[0].toString().padStart(2, '0')}`;
        } else {
            return `TVZapão - Combo ${numbers.length}x Premium`;
        }
    }

    /**
     * Get safe product name (avoids "raffle" terms)
     * @returns {string} Safe product name
     */
    getSafeProductName() {
        const names = [
            "Participação Digital",
            "Experiência Premium",
            "Jogo Numérico",
            "Desafio Online",
            "Concurso Interativo"
        ];
        return names[Math.floor(Math.random() * names.length)];
    }
}

module.exports = new AntiBlockHelper();
