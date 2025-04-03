import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeService, SearchResult, BaseSearchOptions } from './stripeService.js';
import { MCPLogger, LogLevel } from '../logger.js';

// モックを作成
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      dummyMethod: vi.fn().mockResolvedValue({ success: true })
    }))
  };
});

// ロガーのモック
vi.mock('../logger.js', () => {
  return {
    MCPLogger: vi.fn().mockImplementation(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })),
    LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 }
  };
});

describe('StripeService', () => {
  let stripeService: StripeService;
  let mockLogger: MCPLogger;
  const mockApiKeys = {
    '1st_account': 'sk_test_111',
    '2nd_account': 'sk_test_222'
  };

  beforeEach(() => {
    mockLogger = new MCPLogger({ level: LogLevel.INFO });
    stripeService = new StripeService({
      apiKeys: mockApiKeys,
      logger: mockLogger,
      apiVersion: '2025-03-31.basil'
    });
  });

  describe('executeOperation', () => {
    it('should execute operation for a specific account when valid account is provided', async () => {
      const options = { account: '1st_account', param: 'Test' } as BaseSearchOptions;
      const operation = vi.fn().mockResolvedValue({ success: true, message: 'Success' });

      const results = await stripeService.executeOperation(options, operation);

      expect(results).toHaveLength(1);
      expect(results[0].accountName).toBe('1st_account');
      expect(results[0].success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should execute operation for all accounts when account is "all"', async () => {
      const options = { account: 'all', param: 'Test' } as BaseSearchOptions;
      const operation = vi.fn().mockResolvedValue({ success: true, message: 'Success' });

      const results = await stripeService.executeOperation(options, operation);

      expect(results).toHaveLength(2); // 2つのアカウントがあるため
      expect(results[0].accountName).toBe('1st_account');
      expect(results[1].accountName).toBe('2nd_account');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should return error when invalid account is provided', async () => {
      const options = { account: 'invalid_account', param: 'Test' } as BaseSearchOptions;
      const operation = vi.fn();

      const results = await stripeService.executeOperation(options, operation);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('invalid_account');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should return error when no account is provided', async () => {
      const options = { param: 'Test' } as BaseSearchOptions;
      const operation = vi.fn();

      const results = await stripeService.executeOperation(options, operation);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('アカウントが指定されていません');
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('formatResponse', () => {
    it('should format a single result', () => {
      const results: SearchResult[] = [
        { accountName: 'test', success: true, message: 'Success message' }
      ];

      const response = stripeService.formatResponse(results);

      expect(response.content).toHaveLength(1);
      expect(response.content[0].text).toContain('[アカウント: test]');
      expect(response.content[0].text).toContain('Success message');
    });

    it('should format multiple results', () => {
      const results: SearchResult[] = [
        { accountName: 'test1', success: true, message: 'Success message 1' },
        { accountName: 'test2', success: false, message: 'Error message 2' }
      ];

      const response = stripeService.formatResponse(results);

      expect(response.content).toHaveLength(1);
      expect(response.content[0].text).toContain('[アカウント: test1]');
      expect(response.content[0].text).toContain('[アカウント: test2]');
      expect(response.content[0].text).toContain('Success message 1');
      expect(response.content[0].text).toContain('Error message 2');
    });

    it('should handle empty results', () => {
      const results: SearchResult[] = [];

      const response = stripeService.formatResponse(results);

      expect(response.content).toHaveLength(1);
      expect(response.content[0].text).toContain('登録されているStripeアカウント');
    });
  });
}); 