/**
 * Stripe APIサービスクラス
 * 複数のStripeアカウントでの操作を抽象化します
 */

import Stripe from 'stripe';
import { MCPLogger } from '../logger.js';

// 検索結果の型定義
export interface SearchResult {
  accountName: string;
  success: boolean;
  message: string;
  data?: any;
  // List / Search APIがまだデータを持っている場合はtrueになる
  has_more?: boolean;
  // Search APIのみ。この値を渡して次のページを取得する
  next_page?: string;
}

// MCPレスポンスのコンテンツの型定義
export interface MCPResponseContent {
  [key: string]: unknown;
  type: "text";
  text: string;
}

// 検索オプションの基本インターフェース
export interface BaseSearchOptions {
  account?: string;
}

// Stripeサービスクラスのコンストラクタオプション
export interface StripeServiceOptions {
  apiKeys: Record<string, string>;
  logger: MCPLogger;
  apiVersion: Stripe.StripeConfig['apiVersion'];
}

// Stripeサービスクラス
export class StripeService {
  private apiKeys: Record<string, string>;
  private logger: MCPLogger;
  private apiVersion: Stripe.StripeConfig['apiVersion'];

  /**
   * Stripeサービスクラスのコンストラクタ
   * 
   * @param options 設定オプション
   */
  constructor(options: StripeServiceOptions) {
    this.apiKeys = options.apiKeys;
    this.logger = options.logger;
    this.apiVersion = options.apiVersion;
  }

  /**
   * 特定のアカウントのStripeインスタンスを取得
   * 
   * @param accountName アカウント名
   * @returns Stripeインスタンス
   * @throws アカウントが見つからない場合エラー
   */
  private getStripeInstance(accountName: string): Stripe {
    if (!(accountName in this.apiKeys)) {
      throw new Error(`Account ${accountName} not found`);
    }
    return new Stripe(this.apiKeys[accountName], { apiVersion: this.apiVersion });
  }

  /**
   * 指定されたアカウントで関数を実行
   * 
   * @param accountName アカウント名
   * @param operation 実行する関数
   * @returns 検索結果
   */
  private async executeForAccount<T>(
    accountName: string, 
    operation: (stripe: Stripe) => Promise<T>
  ): Promise<SearchResult> {
    try {
      this.logger.info(`Executing operation for account: ${accountName}`);
      const stripe = this.getStripeInstance(accountName);
      const data = await operation(stripe);
      
      return {
        accountName,
        success: true,
        message: `処理が成功しました`,
        data
      };
    } catch (error) {
      this.logger.error(`Error in account ${accountName}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        accountName,
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * すべてのアカウントまたは特定のアカウントで操作を実行
   * 
   * @param options 検索オプション
   * @param operation 実行する関数
   * @returns 検索結果の配列
   */
  public async executeOperation<T extends BaseSearchOptions>(
    options: T,
    operation: (stripe: Stripe, options: Omit<T, 'account'>) => Promise<any>
  ): Promise<SearchResult[]> {
    const { account, ...operationOptions } = options;
    
    // 特定のアカウントが指定された場合
    if (account && account !== 'all' && account in this.apiKeys) {
      const result = await this.executeForAccount(
        account, 
        (stripe) => operation(stripe, operationOptions as Omit<T, 'account'>)
      );
      return [result];
    }
    
    // 「all」が明示的に指定された場合のみ、すべてのアカウントを検索
    else if (account === 'all') {
      const results: SearchResult[] = [];
      
      // 各アカウントで操作を実行
      for (const accountName of Object.keys(this.apiKeys)) {
        const result = await this.executeForAccount(
          accountName, 
          (stripe) => operation(stripe, operationOptions as Omit<T, 'account'>)
        );
        results.push(result);
      }
      
      return results;
    }
    
    // アカウントが指定されていないか、無効な場合
    this.logger.warn(`Invalid account specified: ${account}`);
    const availableAccounts = Object.keys(this.apiKeys).join(', ');
    
    return [{
      accountName: 'none',
      success: false,
      message: account 
        ? `指定されたアカウント "${account}" は見つかりません。利用可能なアカウント: ${availableAccounts || 'なし'}`
        : `アカウントが指定されていません。利用可能なアカウント: ${availableAccounts || 'なし'}`
    }];
  }

  /**
   * 結果をフォーマットして返却
   * 
   * @param results 検索結果の配列
   * @returns フォーマットされたレスポンス
   */
  public formatResponse(results: SearchResult[]): { content: MCPResponseContent[] } {
    if (results.length === 0) {
      return {
        content: [{
          type: "text",
          text: `登録されているStripeアカウントが見つかりません。`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(
            results.reduce((acc, result) => {
                return {
                    ...acc,
                    [result.accountName]: {
                        data: result.data,
                        success: result.success,
                        message: result.message,
                        has_more: result.has_more || undefined,
                        next_page: result.next_page || undefined,
                    }
                }
            }, {} as Record<string, object>)
        )
      }]
    };
  }
} 