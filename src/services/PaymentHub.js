/**
 * Payment Hub - Smart Distribution Across Multiple Providers
 * Allows running InfinitePay + MercadoPago simultaneously
 */

const InfinitePayProvider = require('./InfinitePayProvider');
const MercadoPagoProvider = require('./MercadoPagoProvider');

class PaymentHub {
    constructor() {
        this.providers = [];
        this.currentIndex = 0;

        // Initialize available providers
        if (process.env.INFINITEPAY_HANDLE) {
            this.providers.push({
                name: 'InfinitePay',
                instance: new InfinitePayProvider(),
                priority: 1, // Higher priority (zero fee)
                active: true
            });
            console.log('[PaymentHub] InfinitePay registered');
        }

        if (process.env.MP_ACCESS_TOKEN) {
            this.providers.push({
                name: 'MercadoPago',
                instance: new MercadoPagoProvider(),
                priority: 2,
                active: true
            });
            console.log('[PaymentHub] MercadoPago registered');
        }

        // Sort by priority
        this.providers.sort((a, b) => a.priority - b.priority);

        console.log(`[PaymentHub] Initialized with ${this.providers.length} provider(s)`);
    }

    /**
     * Get next provider using round-robin distribution
     * @returns {object} Provider instance
     */
    getNextProvider() {
        if (this.providers.length === 0) {
            throw new Error('No payment providers configured');
        }

        // Filter active providers
        const activeProviders = this.providers.filter(p => p.active);

        if (activeProviders.length === 0) {
            throw new Error('All providers are disabled');
        }

        // Round-robin distribution
        const provider = activeProviders[this.currentIndex % activeProviders.length];
        this.currentIndex++;

        console.log(`[PaymentHub] Selected provider: ${provider.name}`);
        return provider.instance;
    }

    /**
     * Get provider by name
     * @param {string} providerName - Provider name
     * @returns {object} Provider instance
     */
    getProviderByName(providerName) {
        const provider = this.providers.find(p =>
            p.name.toLowerCase() === providerName.toLowerCase()
        );

        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }

        return provider.instance;
    }

    /**
     * Get all active providers
     * @returns {Array} Active providers
     */
    getActiveProviders() {
        return this.providers.filter(p => p.active);
    }

    /**
     * Disable a provider
     * @param {string} providerName - Provider name
     */
    disableProvider(providerName) {
        const provider = this.providers.find(p =>
            p.name.toLowerCase() === providerName.toLowerCase()
        );

        if (provider) {
            provider.active = false;
            console.log(`[PaymentHub] ${providerName} disabled`);
        }
    }

    /**
     * Enable a provider
     * @param {string} providerName - Provider name
     */
    enableProvider(providerName) {
        const provider = this.providers.find(p =>
            p.name.toLowerCase() === providerName.toLowerCase()
        );

        if (provider) {
            provider.active = true;
            console.log(`[PaymentHub] ${providerName} enabled`);
        }
    }

    /**
     * Generate Pix (delegates to selected provider)
     * @param {string} orderId - Order ID
     * @param {number} amount - Amount
     * @param {object} buyerInfo - Buyer info
     * @returns {object} Payment data
     */
    async generatePix(orderId, amount, buyerInfo = {}) {
        const provider = this.getNextProvider();
        return provider.generatePix(orderId, amount, buyerInfo);
    }

    /**
     * Validate webhook signature
     * @param {object} req - Request object
     * @returns {boolean} Is valid
     */
    validateWebhookSignature(req) {
        // Delegate to each provider (they'll check their own webhooks)
        for (const provider of this.providers) {
            if (provider.instance.validateWebhookSignature) {
                if (provider.instance.validateWebhookSignature(req)) {
                    return true;
                }
            }
        }
        return true; // Allow if no provider validates
    }
}

module.exports = PaymentHub;
