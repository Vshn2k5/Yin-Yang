import { z } from 'zod';

// Authentication validation schemas
export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional()
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

// Profile validation schemas
export const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  website: z.string().url('Invalid URL format').optional().or(z.literal(''))
});

// Social link validation
export const socialLinkSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  username: z.string().min(1, 'Username is required').optional(),
  url: z.string().url('Invalid URL format').optional().or(z.literal(''))
});

// Quest validation
export const questSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description must be less than 500 characters'),
  domain: z.enum(['technical', 'leadership', 'communication', 'business', 'creativity']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  type: z.enum(['daily', 'weekly', 'monthly', 'chain'])
});

// Skill validation
export const skillSchema = z.object({
  name: z.string().min(2, 'Skill name must be at least 2 characters').max(50, 'Skill name must be less than 50 characters'),
  domain: z.enum(['technical', 'leadership', 'communication', 'business', 'creativity']),
  level: z.number().min(1, 'Level must be at least 1').max(100, 'Level must be at most 100').optional(),
  xp: z.number().min(0, 'XP cannot be negative').optional()
});

// Shop item validation
export const shopItemSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters').max(50, 'Item name must be less than 50 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(200, 'Description must be less than 200 characters'),
  price: z.number().min(0, 'Price cannot be negative'),
  category: z.enum(['avatar', 'badge', 'powerup', 'theme'])
});

// Career goal validation
export const careerGoalSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description must be less than 500 characters'),
  targetDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

// Type inference helpers
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type SocialLinkInput = z.infer<typeof socialLinkSchema>;
export type QuestInput = z.infer<typeof questSchema>;
export type SkillInput = z.infer<typeof skillSchema>;
export type ShopItemInput = z.infer<typeof shopItemSchema>;
export type CareerGoalInput = z.infer<typeof careerGoalSchema>;

// Validation helper function
export function validate<T extends z.ZodType>(schema: T, data: unknown): { success: boolean; data?: z.infer<T>; error?: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Validation failed'
    };
  }
  return { success: true, data: result.data };
}

// Rate limiting utility
const requestTimestamps = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 60000): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const timestamps = requestTimestamps.get(key) || [];
  
  // Remove timestamps outside the window
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
  
  if (validTimestamps.length >= maxRequests) {
    const oldestTimestamp = validTimestamps[0];
    const retryAfter = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);
    return { allowed: false, retryAfter };
  }
  
  validTimestamps.push(now);
  requestTimestamps.set(key, validTimestamps);
  return { allowed: true };
}

export function clearRateLimit(key: string): void {
  requestTimestamps.delete(key);
}
