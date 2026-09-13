import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../utils/logger.util';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static config: EmailConfig | null = null;

  /**
   * Initialize email service
   */
  static initialize(): void {
    const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
    const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
    const secure = process.env.EMAIL_SECURE === 'true';
    const user = process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD;
    const from = process.env.EMAIL_FROM || 'noreply@wastefi.com';

    if (!host || !user || !pass) {
      logger.warn('Email service not configured - SMTP credentials missing');
      return;
    }

    this.config = {
      host,
      port,
      secure,
      auth: { user, pass },
      from,
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
    });

    logger.info('Email service initialized', { host, port });
  }

  /**
   * Send email
   */
  static async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      if (!this.transporter || !this.config) {
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      // Validate email address(es)
      const recipients = Array.isArray(request.to) ? request.to : [request.to];
      for (const email of recipients) {
        if (!this.isValidEmail(email)) {
          return {
            success: false,
            error: `Invalid email address: ${email}`,
          };
        }
      }

      // Send email
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        subject: request.subject,
        text: request.text,
        html: request.html,
      });

      logger.info('Email sent successfully', {
        to: this.maskEmail(Array.isArray(request.to) ? request.to[0] : request.to),
        subject: request.subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Failed to send email', {
        error: error as Error,
        to: request.to,
        subject: request.subject,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(email: string, firstName: string): Promise<SendEmailResponse> {
    const subject = 'Welcome to WasteFi!';
    const text = `Hello ${firstName},\n\nWelcome to WasteFi! We're excited to have you on board.\n\nWasteFi is a platform that rewards you for collecting waste and contributing to a cleaner environment.\n\nGet started:\n1. Complete your profile\n2. Find nearby collection points\n3. Start collecting waste and earning rewards\n\nIf you have any questions, feel free to reach out to our support team.\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>Welcome to WasteFi, ${firstName}!</h2>
      <p>We're excited to have you on board.</p>
      <p>WasteFi is a platform that rewards you for collecting waste and contributing to a cleaner environment.</p>
      <h3>Get Started:</h3>
      <ol>
        <li>Complete your profile</li>
        <li>Find nearby collection points</li>
        <li>Start collecting waste and earning rewards</li>
      </ol>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send verification email
   */
  static async sendVerificationEmail(
    email: string,
    firstName: string,
    verificationCode: string
  ): Promise<SendEmailResponse> {
    const subject = 'Verify Your Email - WasteFi';
    const text = `Hello ${firstName},\n\nThank you for registering with WasteFi!\n\nYour verification code is: ${verificationCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>Verify Your Email</h2>
      <p>Hello ${firstName},</p>
      <p>Thank you for registering with WasteFi!</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
        ${verificationCode}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send payment notification email
   */
  static async sendPaymentNotification(
    email: string,
    firstName: string,
    amount: number,
    currency: string,
    transactionId: string
  ): Promise<SendEmailResponse> {
    const subject = 'Payment Received - WasteFi';
    const text = `Hello ${firstName},\n\nYou've received a payment of ${amount} ${currency} from WasteFi.\n\nTransaction ID: ${transactionId}\n\nCheck your wallet for details.\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>Payment Received</h2>
      <p>Hello ${firstName},</p>
      <p>You've received a payment of <strong>${amount} ${currency}</strong> from WasteFi.</p>
      <p><strong>Transaction ID:</strong> ${transactionId}</p>
      <p>Check your wallet for details.</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send collection verified email
   */
  static async sendCollectionVerified(
    email: string,
    firstName: string,
    collectionId: string,
    amount: number,
    currency: string,
    materialType: string,
    weight: number
  ): Promise<SendEmailResponse> {
    const subject = 'Collection Verified - WasteFi';
    const text = `Hello ${firstName},\n\nYour waste collection has been verified!\n\nCollection Details:\n- ID: ${collectionId}\n- Material: ${materialType}\n- Weight: ${weight} kg\n- Earnings: ${amount} ${currency}\n\nPayment will be processed shortly.\n\nKeep up the great work!\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>Collection Verified!</h2>
      <p>Hello ${firstName},</p>
      <p>Your waste collection has been verified!</p>
      <h3>Collection Details:</h3>
      <ul>
        <li><strong>ID:</strong> ${collectionId}</li>
        <li><strong>Material:</strong> ${materialType}</li>
        <li><strong>Weight:</strong> ${weight} kg</li>
        <li><strong>Earnings:</strong> ${amount} ${currency}</li>
      </ul>
      <p>Payment will be processed shortly.</p>
      <p>Keep up the great work!</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send KYC approval email
   */
  static async sendKYCApproved(email: string, firstName: string): Promise<SendEmailResponse> {
    const subject = 'KYC Approved - WasteFi';
    const text = `Hello ${firstName},\n\nGreat news! Your KYC verification has been approved.\n\nYou can now access all WasteFi features including:\n- Collecting waste and earning rewards\n- Withdrawing earnings to your mobile money account\n- Viewing detailed transaction history\n\nThank you for completing the verification process.\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>KYC Approved!</h2>
      <p>Hello ${firstName},</p>
      <p>Great news! Your KYC verification has been approved.</p>
      <h3>You can now access all WasteFi features including:</h3>
      <ul>
        <li>Collecting waste and earning rewards</li>
        <li>Withdrawing earnings to your mobile money account</li>
        <li>Viewing detailed transaction history</li>
      </ul>
      <p>Thank you for completing the verification process.</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send KYC rejection email
   */
  static async sendKYCRejected(
    email: string,
    firstName: string,
    reason?: string
  ): Promise<SendEmailResponse> {
    const subject = 'KYC Verification Update - WasteFi';
    const text = `Hello ${firstName},\n\nWe were unable to approve your KYC verification${
      reason ? ` due to the following reason:\n\n${reason}` : '.'
    }\n\nPlease update your documents and submit them again for verification.\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>KYC Verification Update</h2>
      <p>Hello ${firstName},</p>
      <p>We were unable to approve your KYC verification${
        reason ? ` due to the following reason:</p><p style="color: #d9534f;"><strong>${reason}</strong></p>` : '.'
      }</p>
      <p>Please update your documents and submit them again for verification.</p>
      <p>If you have any questions, please contact our support team.</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send withdrawal confirmation email
   */
  static async sendWithdrawalConfirmation(
    email: string,
    firstName: string,
    amount: number,
    currency: string,
    phoneNumber: string,
    transactionId: string
  ): Promise<SendEmailResponse> {
    const subject = 'Withdrawal Initiated - WasteFi';
    const text = `Hello ${firstName},\n\nYour withdrawal request has been initiated.\n\nWithdrawal Details:\n- Amount: ${amount} ${currency}\n- Phone Number: ${phoneNumber}\n- Transaction ID: ${transactionId}\n\nYou'll receive the funds shortly.\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>Withdrawal Initiated</h2>
      <p>Hello ${firstName},</p>
      <p>Your withdrawal request has been initiated.</p>
      <h3>Withdrawal Details:</h3>
      <ul>
        <li><strong>Amount:</strong> ${amount} ${currency}</li>
        <li><strong>Phone Number:</strong> ${phoneNumber}</li>
        <li><strong>Transaction ID:</strong> ${transactionId}</li>
      </ul>
      <p>You'll receive the funds shortly.</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetToken: string,
    resetUrl: string
  ): Promise<SendEmailResponse> {
    const subject = 'Password Reset Request - WasteFi';
    const text = `Hello ${firstName},\n\nWe received a request to reset your password.\n\nYour password reset code is: ${resetToken}\n\nOr click this link to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe WasteFi Team`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hello ${firstName},</p>
      <p>We received a request to reset your password.</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
        ${resetToken}
      </div>
      <p>Or click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>The WasteFi Team</p>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Mask email for privacy
   */
  private static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (username.length <= 2) return '**@' + domain;
    return username.slice(0, 2) + '***@' + domain;
  }

  /**
   * Check if email service is available
   */
  static isAvailable(): boolean {
    return this.transporter !== null && this.config !== null;
  }
}
