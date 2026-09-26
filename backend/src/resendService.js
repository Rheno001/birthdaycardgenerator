const { Resend } = require('resend');
const db = require('./db');

async function sendBirthdayEmail({ member, cardBuffer }) {
  const settings = await db.getSettings();
  const apiKey = settings.resend_api_key || process.env.RESEND_API_KEY;
  const sender = settings.sender_email || process.env.SENDER_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    console.warn('[Resend] API Key is missing. Email skipped (logged as simulated send).');
    await db.logEmailSent({
      member_id: member.id,
      member_name: member.name,
      member_email: member.email,
      status: 'simulated (no API key configured)',
      resend_id: 'sim_' + Date.now()
    });
    return { success: true, status: 'simulated', message: 'Resend API Key is not set in settings or env. Config saved as simulated.' };
  }

  const resend = new Resend(apiKey);
  const cardBase64 = cardBuffer.toString('base64');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #fbbf24; letter-spacing: 1px; }
          .header p { margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 24px; text-align: center; }
          .card-img { width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-top: 15px; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Happy Birthday, ${member.name}! 🎉</h1>
            <p>Wishing you an extraordinary day filled with joy and success!</p>
          </div>
          <div class="content">
            <p style="font-size: 16px; line-height: 1.6; color: #475569;">
              On behalf of the entire team, we want to wish you a very Happy Birthday! 
              Thank you for being such a valued part of our organization as <strong>${member.designation || 'Team Member'}</strong>.
            </p>
            <img src="cid:birthday-card" alt="Birthday Card" class="card-img" />
          </div>
          <div class="footer">
            <p>Automated Birthday Wishes System • Sent with ❤️</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await resend.emails.send({
      from: `Birthday System <${sender}>`,
      to: [member.email],
      subject: `🎉 Happy Birthday ${member.name}!`,
      html: htmlContent,
      attachments: [
        {
          filename: `Birthday_Card_${member.name.replace(/\s+/g, '_')}.png`,
          content: cardBase64,
          content_type: 'image/png',
          cid: 'birthday-card'
        }
      ]
    });

    console.log(`[Resend] Birthday card email sent to ${member.email}, Resend ID:`, data.id);
    await db.logEmailSent({
      member_id: member.id,
      member_name: member.name,
      member_email: member.email,
      status: 'sent',
      resend_id: data.id
    });

    return { success: true, status: 'sent', data };
  } catch (error) {
    console.error(`[Resend] Failed to send email to ${member.email}:`, error.message);
    await db.logEmailSent({
      member_id: member.id,
      member_name: member.name,
      member_email: member.email,
      status: `failed: ${error.message}`,
      resend_id: ''
    });

    return { success: false, error: error.message };
  }
}

module.exports = { sendBirthdayEmail };
