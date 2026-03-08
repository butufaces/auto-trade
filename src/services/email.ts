import { config } from "../config/env.js";
import logger from "../config/logger.js";
import AboutService from "./about.js";

class EmailService {
  private apiKey: string | null = null;
  private apiUrl = "https://api.brevo.com/v3/smtp/email";

  constructor() {
    if (config.BREVO_API_KEY && config.SMTP_FROM_EMAIL) {
      this.apiKey = config.BREVO_API_KEY;
      logger.info("Email service initialized with Brevo API");
    } else {
      logger.warn("Email service not configured - BREVO_API_KEY missing");
    }
  }

  /**
   * Send email verification link
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    userName: string
  ): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn("Cannot send verification email - API key not configured");
      return false;
    }

    try {
      const about = await AboutService.getAbout();
      const platformName = about.platformName;
      const verificationUrl = `${process.env.BOT_WEBHOOK_URL || "https://your-domain.com"}/verify-email?token=${token}`;

      const payload = {
        sender: {
          name: config.SMTP_FROM_NAME,
          email: config.SMTP_FROM_EMAIL,
        },
        to: [
          {
            email: email,
            name: userName,
          },
        ],
        subject: `Verify Your Email Address - ${platformName}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">${platformName}</h1>
              <p style="margin: 10px 0 0 0;">Email Verification</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <p>Hi ${userName},</p>
              
              <p>Thank you for signing up with ${platformName}! To complete your registration and verify your email, please click the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Verify Email
                </a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                ${verificationUrl}
              </p>
              
              <p style="color: #666; font-size: 12px; margin: 20px 0 0 0;">
                This verification link will expire in ${config.EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES} minutes.
              </p>
              
              <p style="color: #666; font-size: 12px;">
                If you didn't sign up for this account, you can safely ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>© 2026 ${platformName}. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      logger.info(`Verification email sent to ${email}`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to send verification email to ${email}:`,
        error as Error
      );
      return false;
    }
  }

  /**
   * Send profile update confirmation email
   */
  async sendProfileUpdateEmail(
    email: string,
    userName: string,
    changes: Record<string, string>
  ): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn("Cannot send profile update email - API key not configured");
      return false;
    }

    try {
      const about = await AboutService.getAbout();
      const platformName = about.platformName;
      const changesList = Object.entries(changes)
        .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
        .join("");

      const payload = {
        sender: {
          name: config.SMTP_FROM_NAME,
          email: config.SMTP_FROM_EMAIL,
        },
        to: [
          {
            email: email,
            name: userName,
          },
        ],
        subject: `Profile Updated - ${platformName}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">${platformName}</h1>
              <p style="margin: 10px 0 0 0;">Profile Update</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <p>Hi ${userName},</p>
              
              <p>Your profile has been successfully updated with the following changes:</p>
              
              <ul style="background: white; padding: 15px 30px; border-left: 4px solid #667eea; border-radius: 4px;">
                ${changesList}
              </ul>
              
              <p style="color: #666; font-size: 12px; margin: 20px 0 0 0;">
                If you did not make these changes, please contact support immediately.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>© 2026 ${platformName}. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      logger.info(`Profile update email sent to ${email}`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to send profile update email to ${email}:`,
        error as Error
      );
      return false;
    }
  }

  /**
   * Send bank details verification email
   */
  async sendBankDetailsVerificationEmail(
    email: string,
    userName: string,
    verificationUrl: string,
    token: string
  ): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn("Cannot send bank details verification email - API key not configured");
      return false;
    }

    try {
      const about = await AboutService.getAbout();
      const platformName = about.platformName;
      const payload = {
        sender: {
          name: config.SMTP_FROM_NAME,
          email: config.SMTP_FROM_EMAIL,
        },
        to: [
          {
            email: email,
            name: userName,
          },
        ],
        subject: `Confirm Your Bank Details Update - ${platformName}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">${platformName}</h1>
              <p style="margin: 10px 0 0 0;">Confirm Bank Details</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <p>Hi ${userName},</p>
              
              <p>You recently requested to update your bank details. To confirm this change and proceed with the update, please click the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Confirm Bank Details
                </a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                ${verificationUrl}
              </p>
              
              <p style="background: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <strong>🔒 Security Notice:</strong> This link is personal to you and expires in ${config.EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES} minutes. Do not share this email with anyone.
              </p>
              
              <p style="color: #666; font-size: 12px;">
                If you did not request this change, please ignore this email or contact support immediately.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>© 2026 ${platformName}. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      logger.info(`Bank details verification email sent to ${email}`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to send bank details verification email to ${email}:`,
        error as Error
      );
      return false;
    }
  }

  /**
   * Send withdrawal verification email
   */
  async sendWithdrawalVerificationEmail(
    email: string,
    userName: string,
    verificationUrl: string,
    token: string
  ): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn("Cannot send withdrawal verification email - API key not configured");
      return false;
    }

    try {
      const about = await AboutService.getAbout();
      const platformName = about.platformName;
      const payload = {
        sender: {
          name: config.SMTP_FROM_NAME,
          email: config.SMTP_FROM_EMAIL,
        },
        to: [
          {
            email: email,
            name: userName,
          },
        ],
        subject: `Confirm Your Withdrawal Request - ${platformName}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">${platformName}</h1>
              <p style="margin: 10px 0 0 0;">Confirm Withdrawal</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <p>Hi ${userName},</p>
              
              <p>You have requested to withdraw funds from your investment. To confirm and process this withdrawal, please click the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Confirm Withdrawal
                </a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                ${verificationUrl}
              </p>
              
              <p style="background: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <strong>🔒 Security Notice:</strong> This link is personal to you and expires in ${config.WITHDRAWAL_VERIFICATION_TOKEN_EXPIRY_MINUTES} minutes. Do not share this email with anyone.
              </p>
              
              <p style="background: #e7f3ff; padding: 15px; border-radius: 4px; border-left: 4px solid #0066cc; margin: 20px 0;">
                <strong>ℹ️ Next Steps:</strong> After confirming, your withdrawal request will be sent to our administration team for approval. You will receive a notification when payment is initiated.
              </p>
              
              <p style="color: #666; font-size: 12px;">
                If you did not request this withdrawal, please do not click the link and contact support immediately.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>© 2026 ${platformName}. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      logger.info(`Withdrawal verification email sent to ${email}`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to send withdrawal verification email to ${email}:`,
        error as Error
      );
      return false;
    }
  }

  /**
   * Test connection to Brevo API
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/account", {
        method: "GET",
        headers: {
          "api-key": this.apiKey,
        },
      });

      if (response.ok) {
        logger.info("Email service API connection verified");
        return true;
      } else {
        logger.error("Email service API connection failed");
        return false;
      }
    } catch (error) {
      logger.error("Email service connection failed:", error as Error);
      return false;
    }
  }
}

export default new EmailService();
