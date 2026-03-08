import winston from "winston";
import path from "path";
import { config } from "./env.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logDir = config.LOG_DIR;

// Create custom format that includes metadata
const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let metaString = "";
  
  // Include metadata if it exists and is not empty
  if (Object.keys(meta).length > 0) {
    // Filter out winston internal properties
    const filteredMeta = Object.keys(meta)
      .filter(key => !["timestamp", "level", "message"].includes(key))
      .reduce((obj: any, key) => {
        obj[key] = meta[key];
        return obj;
      }, {});
    
    if (Object.keys(filteredMeta).length > 0) {
      metaString = "\n  " + JSON.stringify(filteredMeta, null, 2).replace(/\n/g, "\n  ");
    }
  }
  
  return `${timestamp} [${level}]: ${stack || message}${metaString}`;
});

const transports: winston.transport[] = [
  // Console transport - always enabled
  new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      errors({ stack: true }),
      customFormat
    ),
  }),
];

// File transports - only in production
if (config.NODE_ENV === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: combine(timestamp(), errors({ stack: true }), customFormat),
    }),
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: combine(timestamp(), errors({ stack: true }), customFormat),
    })
  );
}

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(timestamp(), errors({ stack: true }), customFormat),
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
    }),
  ],
});

export default logger;
