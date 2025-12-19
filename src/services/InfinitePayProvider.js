/**
 * InfinitePay Payment Provider
 * Handles Pix payments via InfinitePay with ZERO fees
 */

const AntiBlockHelper = require('../utils/AntiBlockHelper');

class InfinitePayProvider {
    constructor() {
        this.handle = process.env.INFINITEPAY_HANDLE; // InfiniteTag sem $
        this.webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/webhooks/infinitepay` : null;
        this.redirectUrl = process.env.APP_URL ? `${process.env.APP_URL}/payment-success` : null;

        console.log('[InfinitePay] Initialized');
        console.log('[InfinitePay] Handle:', this.handle);
        console.log('[InfinitePay] Webhook URL:', this.webhookUrl);
    }

    /**
     * Generate Pix payment via InfinitePay
     * @param {string} orderId - Order ID (will be used as order_nsu)
     * @param {number} amount - Amount in BRL (R$)
     * @param {object} buyerInfo - Buyer information {name, phone}
     * @returns {object} Payment data with checkout link
     */
    async generatePix(orderId, amount, buyerInfo = {}) {
        if (!this.handle) {
            throw new Error('INFINITEPAY_HANDLE not configured');
        }

        try {
            // Use anti-block helper for obfuscation
            const baseDescription = AntiBlockHelper.getRotatingDescription();

            // Add buyer name if provided
            const buyerName = buyerInfo.name || 'Cliente';
            const description = `${baseDescription} - ${buyerName}`;

            // Add small variance to amount (optional, can enable/disable)
            const useVariance = process.env.USE_AMOUNT_VARIANCE === 'true';
            const finalAmount = useVariance ? AntiBlockHelper.addAmountVariance(amount) : amount;

            // Convert amount to cents (InfinitePay uses cents)
            const amountInCents = Math.round(finalAmount * 100);

            // Build payload
            const payload = {
                handle: this.handle,
                items: [
                    {
                        quantity: 1,
                        price: amountInCents,
                        description: description // Rotating description + buyer name
                    }
                ],
                order_nsu: orderId
            };

            // Add buyer info if provided
            if (buyerInfo.name || buyerInfo.phone) {
                payload.customer = {
                    name: buyerInfo.name || '',
                    phone_number: buyerInfo.phone || ''
                };
            }

            // Add webhook if configured
            if (this.webhookUrl) {
                payload.webhook_url = this.webhookUrl;
            }

            // Add redirect URL if configured
            if (this.redirectUrl) {
                payload.redirect_url = this.redirectUrl;
            }

            console.log('[InfinitePay] Creating checkout link:', JSON.stringify(payload, null, 2));

            // Call InfinitePay API
            const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`InfinitePay API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('[InfinitePay] Checkout created:', data.checkout_url);

            // InfinitePay returns checkout_url, we need to adapt to our format
            // Since it's a link (not QR), we'll create a simple message
            return {
                checkout_url: data.checkout_url,
                pix_copy_paste: data.checkout_url, // User can copy link
                qr_image_data_url: this.generateQRPlaceholder(data.checkout_url), // Placeholder
                invoice_slug: data.invoice_slug || null
            };

        } catch (error) {
            console.error('[InfinitePay] Error generating payment:', error);
            throw error;
        }
    }

    /**
     * Generate a placeholder QR code message
     * Since InfinitePay uses checkout links, not direct QR
     */
    generateQRPlaceholder(checkoutUrl) {
        // Return a data URL with instructions
        const svg = `
            <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="300" fill="#1a1a2e"/>
                <text x="150" y="130" text-anchor="middle" fill="#667eea" font-size="16" font-family="Arial">
                    Clique no botão abaixo
                </text>
                <text x="150" y="150" text-anchor="middle" fill="#667eea" font-size="16" font-family="Arial">
                    para pagar via Pix
                </text>
                <text x="150" y="180" text-anchor="middle" fill="#00f2fe" font-size="20" font-family="Arial" font-weight="bold">
                    InfinitePay
                </text>
            </svg>
        `;

        return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }

    /**
     * Validate webhook signature (if InfinitePay provides one)
     * Currently InfinitePay doesn't use signature validation
     */
    validateWebhookSignature(req) {
        // InfinitePay doesn't provide signature validation in docs
        // Always return true for now
        console.log('[InfinitePay] Webhook received (no signature validation)');
        return true;
    }

    /**
     * Get payment status
     * @param {string} orderNsu - Order NSU (our order_id)
     * @returns {object} Payment status
     */
    async getPayment(orderNsu) {
        if (!this.handle) {
            throw new Error('INFINITEPAY_HANDLE not configured');
        }

        try {
            // Note: To use payment_check, we need transaction_nsu and slug
            // These come from webhook or redirect URL
            // For now, we'll rely on webhook for status updates

            console.log('[InfinitePay] Payment check requested for order:', orderNsu);

            // Return pending status - actual status will come via webhook
            return {
                status: 'pending',
                order_nsu: orderNsu
            };

        } catch (error) {
            console.error('[InfinitePay] Error getting payment:', error);
            throw error;
        }
    }

    /**
     * Check payment status (called from redirect URL parameters)
     * @param {object} params - URL parameters from redirect
     * @returns {object} Payment status
     */
    async checkPaymentStatus(params) {
        const { order_nsu, transaction_nsu, slug } = params;

        if (!this.handle || !order_nsu || !transaction_nsu || !slug) {
            throw new Error('Missing required parameters for payment check');
        }

        try {
            const payload = {
                handle: this.handle,
                order_nsu,
                transaction_nsu,
                slug
            };

            const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/payment_check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Payment check failed: ${response.status}`);
            }

            const data = await response.json();

            return {
                success: data.success,
                paid: data.paid,
                amount: data.amount / 100, // Convert cents to BRL
                paid_amount: data.paid_amount / 100,
                capture_method: data.capture_method
            };

        } catch (error) {
            console.error('[InfinitePay] Error checking payment status:', error);
            throw error;
        }
    }
}

module.exports = InfinitePayProvider;
