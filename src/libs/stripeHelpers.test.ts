import { describe, it, expect } from 'vitest';
import { extractStripeApiKeys } from './stripeHelpers.js';

describe('extractStripeApiKeys', () => {
  it('should extract Stripe API keys from environment variables in the correct format', () => {
    const mockEnv = {
      'STRIPE_1ST_ACCOUNT_APIKEY': 'sk_test_111',
      'STRIPE_2ND_ACCOUNT_APIKEY': 'sk_test_222',
      'STRIPE_3RD_ACCOUNT_APIKEY': 'rk_test_333',
      'STRIPE_INVALID_KEY': 'not_a_valid_key',
      'OTHER_KEY': 'some_value',
      'NODE_ENV': 'test'
    };

    const result = extractStripeApiKeys(mockEnv);
    
    expect(result).toEqual({
      '1st_account': 'sk_test_111',
      '2nd_account': 'sk_test_222',
      '3rd_account': 'rk_test_333'
    });
  });

  it('should exclude keys with invalid authentication format', () => {
    const mockEnv = {
      'STRIPE_1ST_ACCOUNT_APIKEY': 'sk_test_111',
      'STRIPE_2ND_ACCOUNT_APIKEY': 'invalid_key', // Invalid key format
      'STRIPE_3RD_ACCOUNT_APIKEY': 'pk_test_333', // pk_ prefix keys should be excluded
    };

    const result = extractStripeApiKeys(mockEnv);
    
    expect(result).toEqual({
      '1st_account': 'sk_test_111'
    });
  });

  it('should return an empty object when no matching environment variables exist', () => {
    const mockEnv = {
      'OTHER_KEY': 'some_value',
      'NODE_ENV': 'test'
    };

    const result = extractStripeApiKeys(mockEnv);
    
    expect(result).toEqual({});
  });

  it('should filter out undefined environment variables', () => {
    const mockEnv = {
      'STRIPE_1ST_ACCOUNT_APIKEY': 'sk_test_111',
      'STRIPE_AMIMOTO_ACCOUNT_APIKEY': 'rk_test_xxx',
      'STRIPE_2ND_ACCOUNT_APIKEY': undefined,
    };

    const result = extractStripeApiKeys(mockEnv);
    
    expect(result).toEqual({
      '1st_account': 'sk_test_111',
      'amimoto_account': 'rk_test_xxx',
    });
  });
}); 