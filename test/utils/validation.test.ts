import {
  validateDogeAddress,
  validateAmount,
  validateTxHash,
  validatePolygonAddress,
  validateSignature,
  validateDepositRequest,
  validateWithdrawRequest,
  sanitizeInput,
  _rateLimiter
} from '../../src/utils/validation';

describe('Validation Utils', () => {
  beforeEach(() => {
    // Clear rate limiter state between tests
    (_rateLimiter as any).requests.clear();
  });

  describe('validateDogeAddress', () => {
    it('should validate correct Dogecoin addresses', () => {
      expect(validateDogeAddress('D8mHXhuo9XFH5LGDxvqkwN6u2EhBbxxcfb')).toBe(true);
      expect(validateDogeAddress('DRkbCLhvzhdBvMbfvqYogXpL7sjeFFyFFb')).toBe(true);
    });

    it('should reject invalid Dogecoin addresses', () => {
      expect(validateDogeAddress('invalid')).toBe(false);
      expect(validateDogeAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false);
      expect(validateDogeAddress('')).toBe(false);
    });
  });

  describe('validateAmount', () => {
    it('should validate correct amounts', () => {
      expect(validateAmount('1.0')).toBe(true);
      expect(validateAmount('100')).toBe(true);
      expect(validateAmount('0.001')).toBe(true);
    });

    it('should validate amounts within range', () => {
      expect(validateAmount('5', '1', '10')).toBe(true);
      expect(validateAmount('1', '1', '10')).toBe(true);
      expect(validateAmount('10', '1', '10')).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(validateAmount('-1')).toBe(false);
      expect(validateAmount('0')).toBe(false);
      expect(validateAmount('')).toBe(false);
      expect(validateAmount('abc')).toBe(false);
    });

    it('should reject amounts outside range', () => {
      expect(validateAmount('0.5', '1', '10')).toBe(false);
      expect(validateAmount('11', '1', '10')).toBe(false);
    });
  });

  describe('validateTxHash', () => {
    it('should validate correct transaction hashes', () => {
      expect(validateTxHash('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(true);
    });

    it('should reject invalid transaction hashes', () => {
      expect(validateTxHash('invalid')).toBe(false);
      expect(validateTxHash('0x123')).toBe(false);
      expect(validateTxHash('')).toBe(false);
    });
  });

  describe('validatePolygonAddress', () => {
    it('should validate correct Polygon addresses', () => {
      expect(validatePolygonAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')).toBe(true);
    });

    it('should reject invalid Polygon addresses', () => {
      expect(validatePolygonAddress('invalid')).toBe(false);
      expect(validatePolygonAddress('0x123')).toBe(false);
      expect(validatePolygonAddress('')).toBe(false);
    });
  });

  describe('validateSignature', () => {
    it('should validate correct signatures', () => {
      const validSig = '0x' + '1'.repeat(130);
      expect(validateSignature(validSig)).toBe(true);
    });

    it('should reject invalid signatures', () => {
      expect(validateSignature('invalid')).toBe(false);
      expect(validateSignature('0x123')).toBe(false);
      expect(validateSignature('')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags and special characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeInput('Hello <b>World</b>')).toBe('Hello World');
      expect(sanitizeInput('Test\'"\<\>')).toBe('Test');
    });

    it('should remove potentially dangerous content', () => {
      expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
      expect(sanitizeInput('<img onerror=alert(1)>')).toBe('');
      expect(sanitizeInput('data:text/html,<script>alert(1)</script>')).toBe('text/html,alert(1)');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });
  });

  describe('validateDepositRequest with rate limiting', () => {
    const validParams = {
      amount: '1.0',
      minAmount: '0.1',
      maxAmount: '10'
    };

    const context = {
      clientId: 'test-client',
      timestamp: Date.now(),
      network: 'polygon'
    };

    it('should validate correct deposit requests', () => {
      const result = validateDepositRequest(validParams, context);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.isRateLimited).toBe(false);
    });

    it('should enforce rate limiting', () => {
      // Make 10 valid requests
      for (let i = 0; i < 10; i++) {
        const result = validateDepositRequest(validParams, context);
        expect(result.isValid).toBe(true);
      }

      // 11th request should be rate limited
      const result = validateDepositRequest(validParams, context);
      expect(result.isValid).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errors).toContain('Rate limit exceeded. Please try again later.');
    });

    it('should validate network', () => {
      const result = validateDepositRequest(validParams, {
        ...context,
        network: 'ethereum'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid network. Please connect to Polygon network.');
    });

    it('should handle missing context', () => {
      const result = validateDepositRequest(validParams);
      expect(result.isValid).toBe(true);
      expect(result.isRateLimited).toBe(false);
    });

    it('should reject invalid deposit requests', () => {
      const result = validateDepositRequest({
        amount: '-1',
        address: 'invalid'
      }, context);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid amount');
      expect(result.errors).toContain('Invalid Dogecoin address');
    });
  });

  describe('validateWithdrawRequest with rate limiting', () => {
    const validParams = {
      amount: '1.0',
      address: 'D8mHXhuo9XFH5LGDxvqkwN6u2EhBbxxcfb',
      minAmount: '0.1',
      maxAmount: '10'
    };

    const context = {
      clientId: 'test-client-2',
      timestamp: Date.now(),
      network: 'polygon'
    };

    it('should validate correct withdrawal requests', () => {
      const result = validateWithdrawRequest(validParams, context);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.isRateLimited).toBe(false);
    });

    it('should enforce rate limiting', () => {
      // Make 10 valid requests
      for (let i = 0; i < 10; i++) {
        const result = validateWithdrawRequest(validParams, context);
        expect(result.isValid).toBe(true);
      }

      // 11th request should be rate limited
      const result = validateWithdrawRequest(validParams, context);
      expect(result.isValid).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errors).toContain('Rate limit exceeded. Please try again later.');
    });

    it('should validate network', () => {
      const result = validateWithdrawRequest(validParams, {
        ...context,
        network: 'ethereum'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid network. Please connect to Polygon network.');
    });

    it('should handle missing context', () => {
      const result = validateWithdrawRequest(validParams);
      expect(result.isValid).toBe(true);
      expect(result.isRateLimited).toBe(false);
    });

    it('should reject invalid withdrawal requests', () => {
      const result = validateWithdrawRequest({
        amount: '-1',
        address: 'invalid',
        minAmount: '0.1',
        maxAmount: '10'
      }, context);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid amount');
      expect(result.errors).toContain('Invalid Dogecoin address');
    });

    it('should sanitize inputs before validation', () => {
      const result = validateWithdrawRequest({
        amount: '1.0<script>',
        address: 'D8mHXhuo9XFH5LGDxvqkwN6u2EhBbxxcfb<script>',
        minAmount: '0.1',
        maxAmount: '10'
      }, context);
      expect(result.isValid).toBe(true); // Scripts should be stripped before validation
    });
  });
}); 