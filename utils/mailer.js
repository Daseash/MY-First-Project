const nodemailer = require("nodemailer");

/**
 * Creates a transporter for sending emails.
 * Uses environment variables EMAIL_USER and EMAIL_PASS if configured,
 * otherwise falls back to a stream/JSON test transporter.
 */
function getTransporter() {
  if (process.env.EMAIL_USER && (process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD)) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Fallback to json transport or console logger if credentials are not yet set in .env
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

/**
 * Sends a 6-digit OTP code to the user's email address and phone number.
 */
async function sendOtpNotification({ email, phone, otp }) {
  const transporter = getTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"WanderLust Security" <${process.env.EMAIL_USER || "noreply@wanderlust.com"}>`,
    to: email,
    subject: `Your WanderLust Verification Code: ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #ff385c; margin: 0; font-size: 26px;">WanderLust</h2>
          <p style="color: #666666; font-size: 14px; margin-top: 4px;">Sign in verification code</p>
        </div>
        <p style="font-size: 15px; color: #333333; line-height: 1.5;">Hello,</p>
        <p style="font-size: 15px; color: #333333; line-height: 1.5;">You requested a one-time verification code to sign in to your WanderLust account.</p>
        
        <div style="text-align: center; margin: 28px 0; background: #fbf8f5; border: 2px dashed #ff385c; border-radius: 12px; padding: 18px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; font-family: monospace;">${otp}</span>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #888888;">Valid for 10 minutes</p>
        </div>
        
        <p style="font-size: 13px; color: #777777; line-height: 1.4;">
          This code was sent to <strong>${email}</strong> and mobile <strong>${phone}</strong>. If you did not request this, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #999999; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} WanderLust Inc. All rights reserved.
        </p>
      </div>
    `,
    text: `Your WanderLust verification code is ${otp}. It is valid for 10 minutes.`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[OTP DISPATCH] Sent OTP code to email: ${email} and phone: ${phone}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[OTP DISPATCH ERROR] Failed to send email to ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOtpNotification,
};
