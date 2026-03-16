declare module "grammy" {
  interface SessionData {
    pendingDepositPage?: number;
    settingsEditingField?: string | null;
    helpArticleCreation?: {
      step: "title" | "icon" | "content" | "category" | "confirm";
      title?: string;
      icon?: string;
      content?: string;
      category?: string;
      articleId?: string;
    } | null;
    editingHelpArticle?: {
      articleId: string;
      field: "title" | "content" | "icon" | "category";
    };
  }
}

declare module "http" {
  interface IncomingMessage {
    body?: any;
    rawBody?: any;
  }
}

export {};
