import { z } from "zod";

// User Validation
export const userCreateSchema = z.object({
  telegramId: z.bigint(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const userUpdateSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  bankDetails: z.string().optional(),
});

export const userKYCSchema = z.object({
  kycDocument: z.string(),
});

// Package Validation
export const packageSchema = z.object({
  name: z.string().min(1),
  icon: z.string().default("💰"),
  minAmount: z.number().positive(),
  maxAmount: z.number().positive(),
  duration: z.number().positive().int(),
  roiPercentage: z.number().nonnegative(),
  riskLevel: z.enum(["LOW", "LOW_MEDIUM", "MEDIUM", "MEDIUM_HIGH", "HIGH"]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Investment Validation
export const investmentCreateSchema = z.object({
  amount: z.number().positive(),
  packageId: z.string().min(1),
});

export const investmentApprovalSchema = z.object({
  investmentId: z.string().min(1),
  approvalProof: z.string().min(1),
});

export const investmentRejectSchema = z.object({
  investmentId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

// Review Validation
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  packageId: z.string().optional(),
  investmentId: z.string().optional(),
});

// Announcement Validation
export const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(4096),
  targetType: z.enum(["ALL", "ACTIVE_INVESTORS", "COMPLETED_INVESTORS", "NON_INVESTORS", "SPECIFIC_USERS"]),
  targetUserIds: z.array(z.string()).default([]),
});

// Withdrawal Validation
export const withdrawalRequestSchema = z.object({
  amount: z.number().positive(),
  bankDetails: z.string().optional(),
  investmentId: z.string().optional(),
});

export const withdrawalApprovalSchema = z.object({
  withdrawalId: z.string().min(1),
});

export const withdrawalRejectSchema = z.object({
  withdrawalId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

// Settings Validation
export const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.enum(["string", "number", "boolean", "json"]),
  description: z.string().optional(),
});

// Pagination
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});
