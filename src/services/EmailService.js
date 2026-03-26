const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this._init();
  }

  _init() {
    if (process.env.SMTP_HOST) {
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
  }

  async sendMail({ to, subject, html }) {
    if (!this.transporter) {
      console.warn('[EmailService] SMTP not configured, skipping email to:', to);
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
      console.error('[EmailService] Failed to send email:', err.message);
      return false;
    }
  }

  async sendPasswordReset(email, resetToken) {
    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/#/reset-password?token=${resetToken}`;

    return this.sendMail({
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
