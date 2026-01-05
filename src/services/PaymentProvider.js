const MockPaymentSimulator = require('./MockPaymentSimulator');
const MercadoPagoProvider = require('./MercadoPagoProvider');
const InfinitePayProvider = require('./InfinitePayProvider');
const PaymentHub = require('./PaymentHub');

/**
 * Payment Provider Factory
 * Selects provider based on environment
 */
function getPaymentProvider() {
    const provider = process.env.PAYMENT_PROVIDER || 'auto';

    // Hub mode - run multiple providers simultaneously
    if (provider === 'hub') {
        console.log('[PaymentProvider] Using PaymentHub (multi-provider distribution)');
        return new PaymentHub();
    }

    // Manual selection
    if (provider === 'infinitepay') {
        console.log('[PaymentProvider] Using InfinitePay');
        return new InfinitePayProvider();
    }

    if (provider === 'mercadopago') {
        console.log('[PaymentProvider] Using MercadoPago');
        return new MercadoPagoProvider();
    }

    if (provider === 'mock') {
        console.log('[PaymentProvider] Using MockProvider');
        return new MockPaymentSimulator();
    }

    // Auto-detect based on credentials
    if (provider === 'auto') {
        // Check if providers are configured
        const hasInfinitePay = !!process.env.INFINITEPAY_HANDLE;
        const hasMercadoPago = !!process.env.MP_ACCESS_TOKEN;

        // Priority: MercadoPago (user preference) > InfinitePay > Mock
        if (hasMercadoPago) {
            console.log('[PaymentProvider] Using MercadoPago (auto-detected)');
            return new MercadoPagoProvider();
        } else if (hasInfinitePay) {
            console.log('[PaymentProvider] Using InfinitePay (auto-detected)');
            return new InfinitePayProvider();
        } else {
            console.log('[PaymentProvider] Using MockProvider (development)');
            return new MockPaymentSimulator();
        }
    }

    // Default to mock
    console.log('[PaymentProvider] Using MockProvider (default)');
    return new MockPaymentSimulator();
}

module.exports = {
    getPaymentProvider
};
