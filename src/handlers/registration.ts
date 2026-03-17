import { Context, InputFile } from "grammy";
import UserService from "../services/user.js";
import EmailService from "../services/email.js";
import ReferralService from "../services/referral.js";
import prisma from "../db/client.js";
import logger from "../config/logger.js";
import {
  formatCurrency,
  formatDate,
  getUserDisplayName,
} from "../lib/helpers.js";
import {
  mainMenuKeyboard,
  settingsKeyboard,
  profileEditKeyboard,
  editProfileMenuKeyboard,
  profileEditKeyboardWithResend,
  registrationSuccessKeyboard,
  confirmationKeyboard,
} from "../utils/keyboard.js";

type SessionContext = Context & { session: any };

/**
 * Start registration flow
 */
export async function handleStartRegistration(ctx: SessionContext): Promise<void> {
  const user = await UserService.getUserByTelegramId(BigInt(ctx.from!.id));

  if (!user) {
    await ctx.reply("❌ Unable to initialize user");
    return;
  }

  const message = `👋 <b>Welcome to Investment Bot!</b>

Let's get you set up. Please provide the following information:

1️⃣ Name
2️⃣ Email
3️⃣ Phone Number

Let's start with your name. What's your first name?`;

  ctx.session.registrationStep = "firstName";
  await ctx.reply(message, {
    reply_markup: { remove_keyboard: true },
    parse_mode: "HTML",
  });
}

/**
 * Handle registration input (name, email, phone)
 */
export async function handleRegistrationInput(ctx: SessionContext): Promise<void> {
  const input = ctx.message?.text || "";

  if (!ctx.session.registrationStep) {
    ctx.session.registrationStep = "firstName";
  }

  try {
    if (ctx.session.registrationStep === "firstName") {
      if (input.length < 2 || input.length > 50) {
        await ctx.reply(
          "❌ Name should be between 2-50 characters. Try again:"
        );
        return;
      }

      ctx.session.registrationData = {
        firstName: input,
      };
      ctx.session.registrationStep = "lastName";

      await ctx.reply("✅ Got it! Now, what's your last name?", {
        reply_markup: { remove_keyboard: true },
      });
    } else if (ctx.session.registrationStep === "lastName") {
      if (input.length < 2 || input.length > 50) {
        await ctx.reply(
          "❌ Last name should be between 2-50 characters. Try again:"
        );
        return;
      }

      ctx.session.registrationData.lastName = input;
      ctx.session.registrationStep = "email";

      await ctx.reply(
        "✅ Now, please enter your email address:\n\n💡 <i>This will be used for account verification and important notifications</i>",
        {
          reply_markup: { remove_keyboard: true },
          parse_mode: "HTML",
        }
      );
    } else if (ctx.session.registrationStep === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(input)) {
        await ctx.reply("❌ Invalid email format. Please try again:");
        return;
      }

      const emailExists = await UserService.emailExists(input);
      if (emailExists) {
        await ctx.reply(
          "❌ This email is already registered. Please use a different email:"
        );
        return;
      }

      ctx.session.registrationData.email = input;
      ctx.session.registrationStep = "phone";

      await ctx.reply(
        "✅ Now, please enter your phone number:\n\n💡 <i>Example: +1234567890 or 1234567890</i>",
        {
          reply_markup: { remove_keyboard: true },
          parse_mode: "HTML",
        }
      );
    } else if (ctx.session.registrationStep === "phone") {
      const phoneRegex = /^(?:\+|0)?[1-9]\d{1,14}$/;

      if (input.length < 10 || input.length > 20) {
        await ctx.reply(
          "❌ Invalid phone number. Should be 10-20 digits. Try again:"
        );
        return;
      }

      ctx.session.registrationData.phoneNumber = input;
      ctx.session.registrationStep = "referral";

      await ctx.reply(
        "✅ Do you have a referral code? (Optional)\n\n💡 <i>If you were invited by someone, enter their referral code. Otherwise, just type 'skip'</i>",
        {
          reply_markup: { remove_keyboard: true },
          parse_mode: "HTML",
        }
      );
    } else if (ctx.session.registrationStep === "referral") {
      let referralCode: string | undefined;

      if (input.toLowerCase() !== "skip" && input.trim().length > 0) {
        // Validate referral code
        const validation = await ReferralService.validateReferralCode(
          input,
          ctx.session.userId
        );

        if (!validation.valid) {
          await ctx.reply(`❌ ${validation.message}\n\nPlease enter a valid referral code or type 'skip':`);
          return;
        }

        referralCode = input;
        await ctx.reply(`✅ Referral code accepted!`, {
          reply_markup: { remove_keyboard: true },
        });
      }

      ctx.session.registrationData.referralCode = referralCode;

      // Show confirmation
      await ctx.reply(
        `<b>📋 Please confirm your information:</b>\n\n
👤 Name: ${ctx.session.registrationData.firstName} ${ctx.session.registrationData.lastName}
📧 Email: ${ctx.session.registrationData.email}
📞 Phone: ${ctx.session.registrationData.phoneNumber}
${referralCode ? `🎁 Referral Code: ${referralCode}` : ""}

Is this correct?`,
        {
          reply_markup: confirmationKeyboard,
          parse_mode: "HTML",
        }
      );

      ctx.session.registrationStep = "confirm";
    }
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
    delete ctx.session.registrationData;
    ctx.session.registrationStep = undefined;
  }
}

/**
 * Confirm registration
 */
export async function handleConfirmRegistration(
  ctx: SessionContext,
  confirm: boolean
): Promise<void> {
  if (!confirm) {
    ctx.session.registrationStep = "firstName";
    delete ctx.session.registrationData;

    await ctx.reply(
      "❌ Registration cancelled. Let's start over. What's your first name?",
      {
        reply_markup: { remove_keyboard: true },
      }
    );
    return;
  }

  try {
    const { firstName, lastName, email, phoneNumber, referralCode } =
      ctx.session.registrationData;

    // Update user with registration data
    const user = await UserService.updateProfile(ctx.session.userId, {
      firstName,
      lastName,
      email,
      phoneNumber,
    });

    // If referral code was provided, link user to referrer and increment referrer's referral count
    if (referralCode) {
      logger.info(`[REGISTRATION] ✅ Setting referral code for user ${user.id}: ${referralCode}`);
      
      await prisma.user.update({
        where: { id: ctx.session.userId },
        data: {
          referredBy: referralCode,
        },
      });

      logger.info(`[REGISTRATION] ✅ Referral code set in database for ${user.id}`);

      await prisma.user.update({
        where: { referralCode: referralCode },
        data: {
          referralCount: {
            increment: 1,
          },
        },
      });

      logger.info(
        `[REGISTRATION] ✅ User ${user.id} registered with referral code ${referralCode} - referrer count incremented`
      );
    } else {
      logger.info(`[REGISTRATION] User ${user.id} registered without referral code`);
    }

    // Generate and set verification token with the email to verify
    const token = await UserService.setEmailVerificationToken(user.id, email);

    // Send verification email (non-blocking - won't fail registration if email fails)
    EmailService.sendVerificationEmail(
      email,
      token,
      firstName
    ).catch((err) => logger.error("Failed to send verification email:", err));

    await ctx.reply(
      `✅ <b>Registration Successful!</b>\n\n
Your profile has been created:
👤 Name: ${firstName} ${lastName}
📧 Email: ${email}
📞 Phone: ${phoneNumber}

🔐 <b>Email Verification Required:</b>
A verification email has been sent to <code>${email}</code>. 

⏰ <b>What to do:</b>
1. Check your inbox for the verification email
2. Click the verification link in the email
3. Once verified, you can start investing! 🚀

💡 <b>Tips:</b>
• Check your spam/junk folder if you don't see it
• The link expires in 24 hours`,
      {
        reply_markup: registrationSuccessKeyboard,
        parse_mode: "HTML",
      }
    );

    // Clean up session
    delete ctx.session.registrationData;
    ctx.session.registrationStep = undefined;
  } catch (error) {
    await ctx.reply(`❌ Registration failed: ${(error as Error).message}`);
  }
}

/**
 * View and edit profile
 */
export async function handleEditProfile(ctx: SessionContext): Promise<void> {
  const user = await UserService.getUserById(ctx.session.userId);

  if (!user) {
    await ctx.reply("❌ User not found");
    return;
  }

  const isEmailVerified = (user as any).emailVerified;
  const verificationStatus = isEmailVerified
    ? "✅ Verified"
    : "⏳ Pending";

  const message = `<b>👤 My Profile</b>\n\n
<b>Personal Information:</b>
👤 First Name: ${user.firstName || "Not set"}
👤 Last Name: ${user.lastName || "Not set"}
📧 Email: ${user.email || "Not set"} (${verificationStatus})
📞 Phone: ${user.phoneNumber || "Not set"}

<b>Account Details:</b>
🆔 Telegram ID: <code>${user.telegramId}</code>
✅ KYC: ${user.kycVerified ? "✅ Verified" : "❌ Not verified"}
📅 Joined: ${formatDate(user.createdAt)}

<b>Referral:</b>
🔗 Code: <code>${user.referralCode}</code>
👥 Referrals: ${user.referralCount}

Choose what you'd like to edit:`;

  // Use conditional keyboard based on email verification status
  const keyboard = isEmailVerified ? editProfileMenuKeyboard : profileEditKeyboardWithResend;

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}

/**
 * Start editing a specific field
 */
export async function handleStartEditField(
  ctx: SessionContext,
  field: string
): Promise<void> {
  const prompts: Record<string, string> = {
    firstName: "Enter your first name:",
    lastName: "Enter your last name:",
    email:
      "Enter your new email address:\n\n💡 You'll need to verify it after changing.",
    phoneNumber:
      "Enter your phone number:\n\n💡 Example: +1234567890 or 1234567890",
  };

  const prompt = prompts[field];
  if (!prompt) {
    await ctx.reply("❌ Invalid field");
    return;
  }

  ctx.session.editingField = field;
  await ctx.reply(prompt, {
    reply_markup: { remove_keyboard: true },
  });
}

/**
 * Process profile field edit
 */
export async function handleProcessFieldEdit(
  ctx: SessionContext
): Promise<void> {
  const field = ctx.session.editingField;
  const input = ctx.message?.text || "";

  try {
    // Validation
    if (field === "firstName" || field === "lastName") {
      if (input.length < 2 || input.length > 50) {
        await ctx.reply(
          "❌ Name should be between 2-50 characters. Try again:"
        );
        return;
      }
    } else if (field === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        await ctx.reply("❌ Invalid email format. Please try again:");
        return;
      }

      const emailExists = await UserService.emailExists(input);
      if (emailExists) {
        await ctx.reply(
          "❌ This email is already registered. Please use a different email:"
        );
        return;
      }
    } else if (field === "phoneNumber") {
      if (input.length < 10 || input.length > 20) {
        await ctx.reply(
          "❌ Invalid phone number. Should be 10-20 digits. Try again:"
        );
        return;
      }
    }

    // Store for confirmation
    ctx.session.pendingFieldEdit = {
      field,
      value: input,
    };

    const fieldLabels: Record<string, string> = {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phoneNumber: "Phone Number",
    };

    await ctx.reply(
      `<b>Confirm Change</b>\n\n
${fieldLabels[field]}: <code>${input}</code>\n
Is this correct?`,
      {
        reply_markup: confirmationKeyboard,
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Confirm field edit
 */
export async function handleConfirmFieldEdit(
  ctx: SessionContext,
  confirm: boolean
): Promise<void> {
  if (!ctx.session.pendingFieldEdit) {
    await ctx.reply("❌ No pending changes");
    return;
  }

  if (!confirm) {
    delete ctx.session.pendingFieldEdit;
    ctx.session.editingField = undefined;
    await ctx.reply("❌ Change cancelled");
    return;
  }

  try {
    const { field, value } = ctx.session.pendingFieldEdit;
    const updateData: any = {};

    // Special handling for email - need to verify
    if (field === "email") {
      updateData.email = value;
      updateData.emailVerified = false;

      // Update profile with new email but keep unverified
      await UserService.updateProfile(ctx.session.userId, updateData);

      // Generate and set new verification token with the new email
      const token = await UserService.setEmailVerificationToken(
        ctx.session.userId,
        value
      );

      // Send verification email (non-blocking - won't fail registration if email fails)
      const user = await UserService.getUserById(ctx.session.userId);
      if (user) {
        EmailService.sendVerificationEmail(value, token, user.firstName || "User").catch(
          (err) => logger.error("Failed to send verification email:", err)
        );
      }

      await ctx.reply(
        `✅ <b>Email Updated!</b>\n\n
New email: ${value}\n\n
🔐 A verification email has been sent. Please verify to continue using your account.`,
        {
          reply_markup: mainMenuKeyboard,
          parse_mode: "HTML",
        }
      );
    } else {
      updateData[field] = value;

      await UserService.updateProfile(ctx.session.userId, updateData);

      const fieldLabels: Record<string, string> = {
        firstName: "First Name",
        lastName: "Last Name",
        phoneNumber: "Phone Number",
      };

      await ctx.reply(
        `✅ ${fieldLabels[field]} updated successfully!`,
        {
          reply_markup: mainMenuKeyboard,
        }
      );

      // Send profile update email (non-blocking)
      const user = await UserService.getUserById(ctx.session.userId);
      if (user && user.email) {
        const changes: Record<string, string> = {};
        changes[fieldLabels[field]] = value;

        EmailService.sendProfileUpdateEmail(
          user.email,
          user.firstName || "User",
          changes
        ).catch((err) => logger.error("Failed to send profile update email:", err));
      }
    }

    delete ctx.session.pendingFieldEdit;
    ctx.session.editingField = undefined;
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Resend email verification link
 */
export async function handleResendVerificationEmail(
  ctx: SessionContext
): Promise<void> {
  try {
    const user = await UserService.getUserById(ctx.session.userId);

    if (!user) {
      await ctx.reply("❌ User not found");
      return;
    }

    // Check if email is already verified
    if ((user as any).emailVerified) {
      await ctx.reply(
        "✅ Your email is already verified! No need to resend.",
        {
          reply_markup: mainMenuKeyboard,
        }
      );
      return;
    }

    // Check if email exists
    if (!user.email) {
      await ctx.reply(
        "❌ No email found in your profile. Please edit your profile and add an email first.",
        {
          reply_markup: mainMenuKeyboard,
        }
      );
      return;
    }

    // Rate limiting: Check if user already requested a resend recently (prevent spam)
    const lastResendAttempt = (user as any).lastResendAttempt;
    const resendAttempts = (user as any).resendAttempts || 0;

    if (lastResendAttempt) {
      const timeSinceLastResend = Date.now() - new Date(lastResendAttempt).getTime();
      const minutesSinceLastResend = timeSinceLastResend / (1000 * 60);

      // Allow resend only after 5 minutes
      if (minutesSinceLastResend < 5) {
        const minutesRemaining = Math.ceil(5 - minutesSinceLastResend);
        await ctx.reply(
          `⏳ Please wait ${minutesRemaining} minute(s) before requesting another verification email.\n\n💡 Check your spam folder before requesting a new link.`,
          {
            reply_markup: mainMenuKeyboard,
          }
        );
        return;
      }

      // Max 5 resends per 24 hours
      if (resendAttempts >= 5) {
        const lastResendDate = new Date(lastResendAttempt);
        const next24HoursMark = new Date(lastResendDate.getTime() + 24 * 60 * 60 * 1000);

        if (Date.now() < next24HoursMark.getTime()) {
          await ctx.reply(
            `🚫 You've reached the maximum resend limit (5) in the last 24 hours.\n\nPlease try again after 24 hours or contact support if you need help.`,
            {
              reply_markup: mainMenuKeyboard,
            }
          );
          return;
        }
      }
    }

    // Generate and set new verification token
    const token = await UserService.setEmailVerificationToken(user.id, user.email);

    // Send verification email (non-blocking - won't fail the resend if email fails)
    EmailService.sendVerificationEmail(user.email, token, user.firstName || "User").catch((err) =>
      logger.error("Failed to send verification email:", err)
    );

    // Update resend tracking in session only (fields may not exist in database schema)
    ctx.session.lastResendAttempt = new Date();
    ctx.session.resendAttempts = (ctx.session.resendAttempts || 0) + 1;

    await ctx.reply(
      `📧 <b>Verification Email Resent!</b>\n\n
A new verification link has been sent to ${user.email}.

⏰ <b>Link Expires In:</b> 24 hours

💡 <b>Tips:</b>
• Check your spam/junk folder
• Click the link in the email to verify your account
• If you still don't receive it, try again after 5 minutes

Once verified, you can start investing! 🚀`,
      {
        reply_markup: mainMenuKeyboard,
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    logger.error("Error resending verification email:", error);
    await ctx.reply(
      `❌ Failed to resend verification email: ${(error as Error).message}`,
      {
        reply_markup: mainMenuKeyboard,
      }
    );
  }
}

/**
 * Start changing email post-registration (when email verification is pending)
 */
export async function handleChangeEmailPostRegistration(ctx: SessionContext): Promise<void> {
  try {
    const user = await UserService.getUserById(ctx.session.userId);

    if (!user) {
      await ctx.reply("❌ User not found");
      return;
    }

    // Check if email is already verified
    if ((user as any).emailVerified) {
      await ctx.reply(
        "✅ Your email is already verified! To change it, go to Settings → Edit Profile.",
        {
          reply_markup: registrationSuccessKeyboard,
        }
      );
      return;
    }

    ctx.session.changingEmailPostRegistration = true;

    await ctx.reply(
      `✏️ <b>Change Email Address</b>\n\n
Enter your new email address.

💡 After changing, you'll need to verify the new email.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Cancel", callback_data: "start" }]],
        },
      }
    );
  } catch (error) {
    logger.error("Error starting email change:", error);
    await ctx.reply("❌ Error: Unable to change email. Please try again.");
  }
}

/**
 * Save new email post-registration (when user types the new email)
 */
export async function handleSaveNewEmailPostRegistration(ctx: SessionContext, newEmail: string): Promise<void> {
  try {
    const user = await UserService.getUserById(ctx.session.userId);

    if (!user) {
      await ctx.reply("❌ User not found");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      await ctx.reply(
        `❌ Invalid email format: ${newEmail}\n\nPlease enter a valid email address.`,
        {
          parse_mode: "HTML",
        }
      );
      return;
    }

    // Check if email is already in use by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: newEmail,
        id: {
          not: user.id,
        },
      },
    });

    if (existingUser) {
      await ctx.reply(
        `❌ This email is already registered to another account.\n\nPlease use a different email address.`,
        {
          parse_mode: "HTML",
        }
      );
      return;
    }

    // Update email and reset verification
    const updateData: any = {
      email: newEmail,
      emailVerified: false,
    };
    
    await UserService.updateProfile(user.id, updateData);

    // Generate new verification token and send email
    const token = await UserService.setEmailVerificationToken(user.id, newEmail);

    EmailService.sendVerificationEmail(newEmail, token, user.firstName || "User").catch((err) =>
      logger.error("Failed to send verification email:", err)
    );

    await ctx.reply(
      `✅ <b>Email Updated Successfully!</b>\n\n
New Email: <code>${newEmail}</code>\n\n
📧 <b>Verification Email Sent:</b>
A verification link has been sent to your new email address.

⏰ <b>What to do:</b>
1. Check your inbox at ${newEmail}
2. Click the verification link
3. Your account will be fully activated!

💡 <b>Tips:</b>
• Check your spam/junk folder if you don't see it
• The link expires in 24 hours
• You can resend the email anytime`,
      {
        parse_mode: "HTML",
        reply_markup: registrationSuccessKeyboard,
      }
    );

    logger.info(`[REGISTRATION] Email changed post-registration for user ${user.id}:`, {
      oldEmail: user.email,
      newEmail: newEmail,
    });

    // Clean up session
    delete ctx.session.changingEmailPostRegistration;
  } catch (error) {
    logger.error("Error saving new email post-registration:", error);
    await ctx.reply(
      `❌ Failed to update email: ${(error as Error).message}`,
      {
        reply_markup: registrationSuccessKeyboard,
      }
    );
  }
}
