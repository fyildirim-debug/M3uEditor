const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this._init();
  }

  _init() {
    if (!process.env.SMTP_HOST) {
      // Sifre sifirlama, hesap varligini sizdirmamak icin her durumda genel bir
      // basari yaniti doner. SMTP yoksa kullanici hicbir zaman e-posta almaz ve
      // bunu fark edemez; tek uyari noktasi operatordur.
      logger.warn(
        'SMTP_HOST is not set: password reset and welcome emails are disabled. '
        + 'Password reset will keep returning a generic success response, but no message will ever be delivered.'
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * @returns {boolean} SMTP taşıyıcısı yapılandırılmış mı
   */
  isConfigured() {
    return Boolean(this.transporter);
  }

  async sendMail({ to, subject, html }) {
    if (!this.transporter) {
      logger.warn({ recipientDomain: String(to).split('@')[1] || 'unknown' }, 'SMTP is not configured; email skipped');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@m3ueditor.com',
        to,
        subject,
        html,
      });
      return true;
    } catch (err) {
      logger.error({ err }, 'Email could not be sent');
      return false;
    }
  }

  async sendPasswordReset(email, resetToken) {
    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/#/reset-password?token=${resetToken}`;

    // Teslim edilemeyen sifirlama e-postasi kullaniciyi hesabindan kilitler;
    // hosgeldin e-postasinin aksine bu operatorun mudahalesini gerektirir.
    if (!this.isConfigured()) {
      logger.error(
        { recipientDomain: String(email).split('@')[1] || 'unknown' },
        'Password reset requested but SMTP is not configured; the user cannot recover their account'
      );
      return false;
    }

    const delivered = await this.sendMail({
      to: email,
      subject: 'Sifre Sifirlama - M3U Editor',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#111318;color:#edeef2;border-radius:12px;">
          <h2 style="color:#6366f1;margin-bottom:16px;">Sifre Sifirlama</h2>
          <p>Sifrenizi sifirlamak icin asagidaki butona tiklayin:</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;margin:16px 0;font-weight:600;">Sifremi Sifirla</a>
          <p style="font-size:12px;color:#858ba0;margin-top:16px;">Bu link 1 saat icerisinde gecerlidir. Eger siz talep etmediyseniz bu e-postayi gormezden gelebilirsiniz.</p>
        </div>
      `,
    });

    if (!delivered) {
      logger.error(
        { recipientDomain: String(email).split('@')[1] || 'unknown' },
        'Password reset email delivery failed; the user cannot recover their account'
      );
    }
    return delivered;
  }

  async sendWelcome(email) {
    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    return this.sendMail({
      to: email,
      subject: 'Hos Geldiniz - M3U Editor',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#111318;color:#edeef2;border-radius:12px;">
          <h2 style="color:#6366f1;margin-bottom:16px;">M3U Editor'e Hos Geldiniz!</h2>
          <p>Hesabiniz basariyla olusturuldu. Hemen baslamak icin:</p>
          <a href="${baseUrl}/#/dashboard" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;margin:16px 0;font-weight:600;">Dashboard'a Git</a>
        </div>
      `,
    });
  }
}

module.exports = new EmailService();
