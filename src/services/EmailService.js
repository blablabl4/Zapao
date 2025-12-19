/**
 * Email Service - Send verification codes via Gmail
 * Uses Nodemailer with Gmail SMTP
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.fromEmail = process.env.GMAIL_USER;
        this.initialized = false;
    }

    /**
     * Initialize the email transporter
     */
    init() {
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            console.warn('[EmailService] Gmail credentials not configured');
            return false;
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD // App password, NOT regular password
            }
        });

        this.initialized = true;
        console.log('[EmailService] Gmail transporter initialized');
        return true;
    }

    /**
     * Generate a 6-digit verification code
     * @returns {string} 6-digit code
     */
    generateCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Send verification code email
     * @param {string} toEmail - Recipient email
     * @param {string} code - 6-digit verification code
     * @param {string} adminName - Admin name for personalization
     * @returns {boolean} Success status
     */
    async sendVerificationCode(toEmail, code, adminName = 'Admin') {
        if (!this.initialized) {
            this.init();
        }

        if (!this.transporter) {
            console.error('[EmailService] Transporter not initialized');
            return false;
        }

        const mailOptions = {
            from: `"TVZapão Admin" <${this.fromEmail}>`,
            to: toEmail,
            subject: '🔐 Código de Verificação - TVZapão Admin',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0;">🎰 TVZapão</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Painel Administrativo</p>
                    </div>
                    
                    <div style="background: #1a1a2e; padding: 30px; border-radius: 0 0 10px 10px; color: #fff;">
                        <p style="margin: 0 0 20px 0;">Olá, <strong>${adminName}</strong>!</p>
                        
                        <p style="margin: 0 0 20px 0;">Seu código de verificação é:</p>
                        
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: white;">${code}</span>
                        </div>
                        
                        <p style="color: #888; font-size: 14px; margin: 20px 0 0 0;">
                            ⏱️ Este código expira em <strong>5 minutos</strong>.<br>
                            🔒 Não compartilhe este código com ninguém.
                        </p>
                    </div>
                    
                    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
                        Se você não solicitou este código, ignore este email.
                    </p>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`[EmailService] Verification code sent to ${toEmail}`);
            return true;
        } catch (error) {
            console.error('[EmailService] Error sending email:', error.message);
            return false;
        }
    }
}

module.exports = new EmailService();
