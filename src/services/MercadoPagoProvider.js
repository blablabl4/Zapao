/**
 * Mercado Pago Provider using REST API directly
 * Avoids SDK version issues
 */
class MercadoPagoProvider {
    constructor() {
        this.accessToken = process.env.MP_ACCESS_TOKEN;

        if (!this.accessToken) {
            console.warn('[MercadoPago] Access token not configured. Using mock mode.');
            this.client = null;
        } else {
            this.client = true; // Flag to indicate configured
            console.log('[MercadoPago] Configured with production token');
        }
    }

    /**
     * Generate Pix payment via REST API
     * @param {string} orderId - Order ID
     * @param {number} amount - Amount in BRL
     * @param {object} buyerInfo - Buyer details (name, phone)
     * @returns {object} Payment data with QR code
     */
    async generatePix(orderId, amount, buyerInfo = {}) {
        if (!this.client) {
            console.warn('[MercadoPago] Not configured, using mock');
            return this._generateMockPix(orderId, amount);
        }

        try {
            // Build description with client info for easy lookup
            const clientName = buyerInfo.name || 'Cliente';
            const clientPhone = buyerInfo.phone || '';
            const shortOrderId = orderId.substring(0, 8);
            const description = `Ebook #${shortOrderId} - ${clientName}`;

            const paymentData = {
                transaction_amount: Number(amount),
                description: description, // Includes client name + order ID
                payment_method_id: 'pix',
                external_reference: orderId,
                payer: {
                    email: process.env.PAYER_EMAIL || 'cliente@tvzapao.com.br',
                    first_name: clientName.split(' ')[0] || 'Cliente',
                    last_name: clientName.split(' ').slice(1).join(' ') || 'Digital'
                },
                notification_url: `${process.env.APP_URL || 'https://www.tvzapao.com.br'}/api/webhooks/pix`,
                metadata: {
                    buyer_name: clientName,
                    buyer_phone: clientPhone,
                    order_id: orderId
                }
            };

            console.log('[MercadoPago] Creating Pix:', { orderId, amount, clientName, clientPhone });

            // Call Mercado Pago REST API directly
            const response = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`,
                    'X-Idempotency-Key': `order-${orderId}-${Date.now()}`
                },
                body: JSON.stringify(paymentData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[MercadoPago] API Error:', errorData);
                throw new Error(`MP API Error: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();

            if (!data.point_of_interaction || !data.point_of_interaction.transaction_data) {
                throw new Error('Invalid response structure from Mercado Pago');
            }

            const txData = data.point_of_interaction.transaction_data;
            const qrCodeBase64 = txData.qr_code_base64;
            const pixCopyPaste = txData.qr_code;

            console.log('[MercadoPago] Pix created successfully:', {
                paymentId: data.id,
                orderId,
                status: data.status
            });

            return {
                payment_id: data.id,
                qr_image_data_url: `data:image/png;base64,${qrCodeBase64}`,
                pix_copy_paste: pixCopyPaste,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
            };

        } catch (error) {
            console.error('[MercadoPago] Error generating Pix:', error.message);
            console.error('[MercadoPago] Stack:', error.stack);

            // Fallback to mock
            console.warn('[MercadoPago] Falling back to mock Pix');
            return this._generateMockPix(orderId, amount);
        }
    }

    /**
     * Validate Mercado Pago webhook signature
     */
    validateWebhookSignature(req) {
        if (!this.client) {
            console.warn('[MercadoPago] Signature validation skipped (not configured)');
            return true;
        }

        try {
            const xSignature = req.headers['x-signature'];
            const xRequestId = req.headers['x-request-id'];

            if (!xSignature || !xRequestId) {
                console.error('[MercadoPago] Missing signature headers');
                return false;
            }

            const dataId = req.query['data.id'];
            const parts = xSignature.split(',');
            const ts = parts.find(p => p.startsWith('ts=')).split('=')[1];
            const hash = parts.find(p => p.startsWith('v1=')).split('=')[1];
            const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

            const crypto = require('crypto');
            const secret = process.env.MP_WEBHOOK_SECRET || '';
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(manifest);
            const expectedHash = hmac.digest('hex');

            return expectedHash === hash;

        } catch (error) {
            console.error('[MercadoPago] Error validating signature:', error.message);
            return false;
        }
    }

    /**
     * Get payment details from Mercado Pago
     */
    async getPayment(paymentId) {
        if (!this.client) {
            throw new Error('MercadoPago not configured');
        }

        try {
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch payment: ${response.statusText}`);
            }

            const payment = await response.json();

            return {
                id: payment.id,
                status: payment.status,
                status_detail: payment.status_detail,
                transaction_amount: payment.transaction_amount,
                external_reference: payment.external_reference,
                date_approved: payment.date_approved,
                payer: payment.payer
            };

        } catch (error) {
            console.error('[MercadoPago] Error fetching payment:', error.message);
            throw error;
        }
    }

    /**
     * Search payments by external_reference (order_id)
     * Used by reconciliation job to find missed confirmations
     */
    async searchPayments(externalReference) {
        if (!this.client) {
            return [];
        }

        try {
            const response = await fetch(
                `https://api.mercadopago.com/v1/payments/search?external_reference=${externalReference}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.results || [];

        } catch (error) {
            console.error('[MercadoPago] Error searching payments:', error.message);
            return [];
        }
    }

    /**
     * Mock Pix generation (fallback)
     */
    _generateMockPix(orderId, amount) {
        const QRCode = require('qrcode');
        const pixCopyPaste = `00020126580014BR.GOV.BCB.PIX0136${orderId}520400005303986540${amount.toFixed(2)}5802BR5913TVZAPAO6009SAO PAULO`;

        return QRCode.toDataURL(pixCopyPaste)
            .then(qrDataUrl => ({
                payment_id: `mock_${orderId}`,
                qr_image_data_url: qrDataUrl,
                pix_copy_paste: pixCopyPaste,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
            }))
            .catch(err => {
                console.error('[MercadoPago] QR generation error:', err);
                return {
                    payment_id: `mock_${orderId}`,
                    qr_image_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                    pix_copy_paste: pixCopyPaste,
                    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
                };
            });
    }
}

module.exports = MercadoPagoProvider;
