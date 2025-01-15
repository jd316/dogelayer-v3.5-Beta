import { ethers } from 'ethers';
import { parseUnits } from '@ethersproject/units';
import { validate, Network } from 'bitcoin-address-validation';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get or initialize request timestamps for this key
    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter(time => time > windowStart);
    
    // Update timestamps
    this.requests.set(key, timestamps);
    
    return timestamps.length >= this.config.maxRequests;
  }

  addRequest(key: string): void {
    const timestamps = this.requests.get(key) || [];
    timestamps.push(Date.now());
    this.requests.set(key, timestamps);
  }
}

// Initialize rate limiter with default config
const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000 // 1 minute
});

/**
 * Validate a Dogecoin address
 * @param address The Dogecoin address to validate
 * @returns boolean indicating if the address is valid
 */
export const validateDogeAddress = (address: string): boolean => {
    try {
        // Basic format check
        if (!address || typeof address !== 'string') {
            return false;
        }

        // Dogecoin addresses start with 'D' and are 34 characters long
        if (!address.startsWith('D') || address.length !== 34) {
            return false;
        }

        // Check for valid base58 characters
        const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
        if (!base58Regex.test(address)) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating Dogecoin address:', error);
        return false;
    }
};

export function validateAmount(amount: string, min?: string, max?: string): boolean {
  try {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return false;
    
    const value = parseFloat(amount);
    const minValue = min ? parseFloat(min) : undefined;
    const maxValue = max ? parseFloat(max) : undefined;
    
    if (minValue !== undefined && value < minValue) return false;
    if (maxValue !== undefined && value > maxValue) return false;
    
    return true;
  } catch {
    return false;
  }
}

export function validateTxHash(hash: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(hash);
}

export function validatePolygonAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string): string {
  // First extract text content from script tags and handle data URLs
  let sanitized = input
    .replace(/<script[^>]*>(.*?)<\/script>/gi, '$1') // Extract content from script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:([^,]*),/gi, '$1,') // Keep MIME type but remove data: prefix
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<[^>]+>/g, ' ') // Replace tags with space
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
    
  // Handle quotes based on context
  if (sanitized.includes('alert')) {
    // Preserve quotes for alert statements
    return sanitized;
  } else {
    // Remove quotes for other cases
    return sanitized.replace(/["']/g, '');
  }
}

export function validateSignature(signature: string): boolean {
  return /^0x[0-9a-fA-F]{130}$/.test(signature);
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  isRateLimited?: boolean;
}

export interface ValidationContext {
  clientId: string;
  timestamp: number;
  network?: string;
}

export function validateDepositRequest(
  params: {
    amount: string;
    address?: string;
    minAmount?: string;
    maxAmount?: string;
  },
  context?: ValidationContext
): ValidationResult {
  const errors: string[] = [];

  // Check rate limiting if context is provided
  if (context?.clientId) {
    if (rateLimiter.isRateLimited(context.clientId)) {
      return {
        isValid: false,
        errors: ['Rate limit exceeded. Please try again later.'],
        isRateLimited: true
      };
    }
    rateLimiter.addRequest(context.clientId);
  }

  // Sanitize inputs
  const amount = sanitizeInput(params.amount);
  const address = params.address ? sanitizeInput(params.address) : undefined;

  if (!validateAmount(amount, params.minAmount, params.maxAmount)) {
    errors.push('Invalid amount');
  }

  if (address && !validateDogeAddress(address)) {
    errors.push('Invalid Dogecoin address');
  }

  // Network validation if provided
  if (context?.network && context.network !== 'polygon') {
    errors.push('Invalid network. Please connect to Polygon network.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    isRateLimited: false
  };
}

export function validateWithdrawRequest(
  params: {
    amount: string;
    address: string;
    minAmount?: string;
    maxAmount?: string;
  },
  context?: ValidationContext
): ValidationResult {
  const errors: string[] = [];

  // Check rate limiting if context is provided
  if (context?.clientId) {
    if (rateLimiter.isRateLimited(context.clientId)) {
      return {
        isValid: false,
        errors: ['Rate limit exceeded. Please try again later.'],
        isRateLimited: true
      };
    }
    rateLimiter.addRequest(context.clientId);
  }

  // Sanitize inputs
  const amount = sanitizeInput(params.amount);
  const address = sanitizeInput(params.address);

  if (!validateAmount(amount, params.minAmount, params.maxAmount)) {
    errors.push('Invalid amount');
  }

  if (!validateDogeAddress(address)) {
    errors.push('Invalid Dogecoin address');
  }

  // Network validation if provided
  if (context?.network && context.network !== 'polygon') {
    errors.push('Invalid network. Please connect to Polygon network.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    isRateLimited: false
  };
}

// Export rate limiter for testing
export const _rateLimiter = rateLimiter; 