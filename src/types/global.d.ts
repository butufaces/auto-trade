declare module "grammy" {
  interface SessionData {
    pendingDepositPage?: number;
    settingsEditingField?: string | null;
  }
}

declare module "http" {
  interface IncomingMessage {
    body?: any;
    rawBody?: any;
  }
}

export {};
