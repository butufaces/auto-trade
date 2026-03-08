import { config } from "../config/env.js";
import logger from "../config/logger.js";
import prisma from "../db/client.js";

export interface PlatformAbout {
  platformName: string;
  about: string;
  website?: string;
  supportEmail?: string;
  mission?: string;
  vision?: string;
  termsUrl?: string;
  privacyUrl?: string;
  welcomeText?: string; // Custom welcome message text
  welcomeMediaFileId?: string; // Telegram file_id for reliability
  welcomeMediaType?: string; // 'photo', 'video', 'animation'
}

// In-memory cache for ABOUT information
let platformAboutCache: PlatformAbout | null = null;

export class AboutService {
  /**
   * Get platform about information from cache or database
   */
  static async getAbout(): Promise<PlatformAbout> {
    // Return from cache if available
    if (platformAboutCache) {
      logger.info(`[AboutService] Returning from cache:`, {
        hasMedia: !!platformAboutCache.welcomeMediaFileId,
        mediaType: platformAboutCache.welcomeMediaType,
      });
      return platformAboutCache;
    }

    try {
      // Try to load from database Settings
      const dbSettings = await prisma.settings.findMany({
        where: {
          key: {
            in: [
              "PLATFORM_NAME",
              "PLATFORM_ABOUT",
              "PLATFORM_WEBSITE",
              "PLATFORM_SUPPORT_EMAIL",
              "PLATFORM_MISSION",
              "PLATFORM_VISION",
              "PLATFORM_TERMS_URL",
              "PLATFORM_PRIVACY_URL",
              "WELCOME_TEXT",
              "WELCOME_MEDIA_FILE_ID",
              "WELCOME_MEDIA_TYPE",
            ],
          },
        },
      });

      logger.info(`[AboutService] Loaded ${dbSettings.length} settings from database`);
      const mediaFileSetting = dbSettings.find((s) => s.key === "WELCOME_MEDIA_FILE_ID");
      const mediaTypeSetting = dbSettings.find((s) => s.key === "WELCOME_MEDIA_TYPE");
      logger.info(`[AboutService] Media settings:`, {
        fileIdExists: !!mediaFileSetting,
        fileId: mediaFileSetting?.value?.substring(0, 20),
        typeExists: !!mediaTypeSetting,
        type: mediaTypeSetting?.value,
      });

      const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

      platformAboutCache = {
        platformName:
          (settingsMap.get("PLATFORM_NAME") as string) || config.PLATFORM_NAME,
        about: (settingsMap.get("PLATFORM_ABOUT") as string) || config.PLATFORM_ABOUT,
        website: (settingsMap.get("PLATFORM_WEBSITE") as string) || config.PLATFORM_WEBSITE,
        supportEmail:
          (settingsMap.get("PLATFORM_SUPPORT_EMAIL") as string) ||
          config.PLATFORM_SUPPORT_EMAIL,
        mission: (settingsMap.get("PLATFORM_MISSION") as string) || "",
        vision: (settingsMap.get("PLATFORM_VISION") as string) || "",
        termsUrl: (settingsMap.get("PLATFORM_TERMS_URL") as string) || "",
        privacyUrl: (settingsMap.get("PLATFORM_PRIVACY_URL") as string) || "",
        welcomeText: (settingsMap.get("WELCOME_TEXT") as string) || "",
        welcomeMediaFileId: (settingsMap.get("WELCOME_MEDIA_FILE_ID") as string) || "",
        welcomeMediaType: (settingsMap.get("WELCOME_MEDIA_TYPE") as string) || "photo",
      };

      logger.info(`[AboutService] Cache updated with media:`, {
        hasMedia: !!platformAboutCache.welcomeMediaFileId,
        mediaType: platformAboutCache.welcomeMediaType,
      });

      return platformAboutCache;
    } catch (error) {
      logger.warn("Failed to load about from database, using defaults:", error);
      // Fallback to ENV config if database fails
      platformAboutCache = {
        platformName: config.PLATFORM_NAME,
        about: config.PLATFORM_ABOUT,
        website: config.PLATFORM_WEBSITE,
        supportEmail: config.PLATFORM_SUPPORT_EMAIL,
        mission: "",
        vision: "",
        termsUrl: "",
        privacyUrl: "",
        welcomeText: "",
        welcomeMediaFileId: "",
        welcomeMediaType: "photo",
      };
      return platformAboutCache;
    }
  }

  /**
   * Update welcome media file_id and type
   */
  static async updateWelcomeMedia(
    mediaFileId: string,
    mediaType: "photo" | "video" | "animation" = "photo"
  ): Promise<void> {
    try {
      logger.info(`[AboutService] Updating welcome media:`, {
        fileId: mediaFileId?.substring(0, 20),
        type: mediaType,
      });

      const fileIdResult = await prisma.settings.upsert({
        where: { key: "WELCOME_MEDIA_FILE_ID" },
        create: { key: "WELCOME_MEDIA_FILE_ID", value: mediaFileId, type: "string", description: "Welcome message media file_id" },
        update: { value: mediaFileId, updatedAt: new Date() },
      });
      
      logger.info(`[AboutService] Updated WELCOME_MEDIA_FILE_ID:`, {
        key: fileIdResult.key,
        value: fileIdResult.value?.substring(0, 20),
      });

      const typeResult = await prisma.settings.upsert({
        where: { key: "WELCOME_MEDIA_TYPE" },
        create: { key: "WELCOME_MEDIA_TYPE", value: mediaType, type: "string", description: "Welcome media type: photo, video, animation" },
        update: { value: mediaType, updatedAt: new Date() },
      });

      logger.info(`[AboutService] Updated WELCOME_MEDIA_TYPE:`, {
        key: typeResult.key,
        value: typeResult.value,
      });

      // Invalidate cache
      platformAboutCache = null;
      logger.info(`[AboutService] Cache invalidated. Welcome media updated: ${mediaType}`);
    } catch (error) {
      logger.error("Failed to update welcome media:", error);
      throw error;
    }
  }

  /**
   * Update a specific setting in the database and cache
   */
  private static async saveSetting(
    key: string,
    value: string,
    description?: string
  ): Promise<void> {
    try {
      await prisma.settings.upsert({
        where: { key },
        create: { key, value, description, type: "string" },
        update: { value, updatedAt: new Date() },
      });

      // Invalidate cache
      platformAboutCache = null;
      logger.info(`Setting saved: ${key}`);
    } catch (error) {
      logger.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Update platform name
   */
  static async setPlatformName(name: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_NAME",
      name,
      "Platform display name"
    );
    const about = await this.getAbout();
    logger.info(`Platform name updated to: ${name}`);
    return about;
  }

  /**
   * Update about text
   */
  static async setAbout(about: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_ABOUT",
      about,
      "Platform description/about text"
    );
    const aboutData = await this.getAbout();
    logger.info(`Platform about updated`);
    return aboutData;
  }

  /**
   * Update welcome text
   */
  static async setWelcomeText(welcomeText: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "WELCOME_TEXT",
      welcomeText,
      "Welcome message text for /start command"
    );
    const aboutData = await this.getAbout();
    logger.info(`Welcome text updated`);
    return aboutData;
  }

  /**
   * Update website
   */
  static async setWebsite(website: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_WEBSITE",
      website,
      "Platform website URL"
    );
    const about = await this.getAbout();
    logger.info(`Platform website updated to: ${website}`);
    return about;
  }

  /**
   * Update support email
   */
  static async setSupportEmail(email: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_SUPPORT_EMAIL",
      email,
      "Platform support email address"
    );
    const about = await this.getAbout();
    logger.info(`Platform support email updated to: ${email}`);
    return about;
  }

  /**
   * Update mission statement
   */
  static async setMission(mission: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_MISSION",
      mission,
      "Platform mission statement"
    );
    const about = await this.getAbout();
    logger.info(`Platform mission updated`);
    return about;
  }

  /**
   * Update vision statement
   */
  static async setVision(vision: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_VISION",
      vision,
      "Platform vision statement"
    );
    const about = await this.getAbout();
    logger.info(`Platform vision updated`);
    return about;
  }

  /**
   * Update terms URL
   */
  static async setTermsUrl(url: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_TERMS_URL",
      url,
      "URL to terms and conditions"
    );
    const about = await this.getAbout();
    logger.info(`Platform terms URL updated`);
    return about;
  }

  /**
   * Update privacy URL
   */
  static async setPrivacyUrl(url: string): Promise<PlatformAbout> {
    await this.saveSetting(
      "PLATFORM_PRIVACY_URL",
      url,
      "URL to privacy policy"
    );
    const about = await this.getAbout();
    logger.info(`Platform privacy URL updated`);
    return about;
  }

  /**
   * Update entire about object
   */
  static async updateAbout(data: Partial<PlatformAbout>): Promise<PlatformAbout> {
    const updates = [];
    if (data.platformName)
      updates.push(
        this.saveSetting(
          "PLATFORM_NAME",
          data.platformName,
          "Platform display name"
        )
      );
    if (data.about)
      updates.push(
        this.saveSetting(
          "PLATFORM_ABOUT",
          data.about,
          "Platform description/about text"
        )
      );
    if (data.website)
      updates.push(
        this.saveSetting(
          "PLATFORM_WEBSITE",
          data.website,
          "Platform website URL"
        )
      );
    if (data.supportEmail)
      updates.push(
        this.saveSetting(
          "PLATFORM_SUPPORT_EMAIL",
          data.supportEmail,
          "Platform support email address"
        )
      );
    if (data.mission)
      updates.push(
        this.saveSetting(
          "PLATFORM_MISSION",
          data.mission,
          "Platform mission statement"
        )
      );
    if (data.vision)
      updates.push(
        this.saveSetting(
          "PLATFORM_VISION",
          data.vision,
          "Platform vision statement"
        )
      );
    if (data.termsUrl)
      updates.push(
        this.saveSetting(
          "PLATFORM_TERMS_URL",
          data.termsUrl,
          "URL to terms and conditions"
        )
      );
    if (data.privacyUrl)
      updates.push(
        this.saveSetting(
          "PLATFORM_PRIVACY_URL",
          data.privacyUrl,
          "URL to privacy policy"
        )
      );

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    const about = await this.getAbout();
    logger.info(`Platform about information updated`);
    return about;
  }

  /**
   * Format about information for display
   */
  static async formatAboutMessage(): Promise<string> {
    const about = await this.getAbout();
    let message = `<b>✨ ${about.platformName}</b>\n\n`;
    
    message += `<b>📖 About Us</b>\n${about.about}\n\n`;
    
    if (about.mission) {
      message += `<b>🎯 Mission</b>\n${about.mission}\n\n`;
    }
    
    if (about.vision) {
      message += `<b>🔭 Vision</b>\n${about.vision}\n\n`;
    }
    
    if (about.website) {
      message += `<b>🌐 Website:</b> ${about.website}\n`;
    }
    
    if (about.supportEmail) {
      message += `<b>📧 Support Email:</b> ${about.supportEmail}\n`;
    }

    if (about.termsUrl) {
      message += `<b>📜 Terms:</b> ${about.termsUrl}\n`;
    }

    if (about.privacyUrl) {
      message += `<b>🔒 Privacy:</b> ${about.privacyUrl}\n`;
    }

    return message;
  }
}

export default AboutService;
