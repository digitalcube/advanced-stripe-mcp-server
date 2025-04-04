/**
 * Stripe API操作の具体的な実装
 * StripeServiceから分離し、各操作の実装を管理します
 */

import Stripe from 'stripe';
import { BaseSearchOptions } from './stripeService.js';

// 操作結果の共通型
interface OperationResult<T> {
  success: boolean;
  data: T;
  error?: any;
  message?: string;
  has_more?: boolean; // ページネーション用に追加
}

// 操作関数の型定義をジェネリックで作成
type Operation<TOptions, TResult> = 
  (stripe: Stripe, options: TOptions & BaseSearchOptions) => Promise<OperationResult<TResult>>;

// 基本操作インターフェース
interface BaseOperations {
  [key: string]: Operation<any, any>;
}

// 顧客関連の操作に必要な型定義
interface CustomerOperationsType extends BaseOperations {
  searchByName: Operation<{ name: string }, Stripe.Customer[]>;
  searchByEmail: Operation<{ email: string }, Stripe.Customer[]>;
}

/**
 * 顧客関連の操作
 */
export const CustomerOperations: CustomerOperationsType = {
  /**
   * 顧客を名前で検索
   */
  async searchByName(stripe: Stripe, options: { name: string } & BaseSearchOptions) {
    const result = await stripe.customers.search({
        query: `name~"${options.name}"`
    });
    
    return { 
      success: true, 
      data: result.data,
    };
  },

  /**
   * 顧客をメールアドレスで検索
   */
  async searchByEmail(stripe: Stripe, options: { email: string } & BaseSearchOptions) {
    const result = await stripe.customers.list({ email: options.email});
    return {
        success: true,
        data: result.data,
    }
  }
};

// サブスクリプション関連の操作に必要な型定義
interface SubscriptionOperationsType extends BaseOperations {
  searchByCustomerId: Operation<{ customerId: string }, Stripe.Subscription[]>;
  search: Operation<Stripe.SubscriptionListParams, Stripe.Subscription[]>;
  searchAll: Operation<Stripe.SubscriptionListParams, Stripe.Subscription[]>;
}

/**
 * サブスクリプション関連の操作
 */
export const SubscriptionOperations: SubscriptionOperationsType = {
  /**
   * サブスクリプションを顧客IDで検索
   */
  async searchByCustomerId(stripe: Stripe, options: { customerId: string } & BaseSearchOptions) {
    const result = await stripe.subscriptions.list({ customer: options.customerId})
    return {
      success: true,
      data: result.data,
    }
  },
  async search(stripe: Stripe, options: Stripe.SubscriptionListParams) {
    const result = await stripe.subscriptions.list({
      ...options,
      limit: 100,
    })
    return {
      success: true,
      data: result.data,
      message: `Found ${result.data.length} subscriptions. If you need to search more than 100, please use the searchAll function.`,
    }
  },
  async searchAll(stripe: Stripe, options: Stripe.SubscriptionListParams) {
    const result: Stripe.Subscription[] = []
    for await (const item of stripe.subscriptions.list({...options, limit: 20})) {
      result.push(item)
    }
    return {
      success: true,
      data: result,
      message: `Found ${result.length} subscriptions.`,
    }
  }
};

// 請求書関連の操作に必要な型定義
interface InvoiceOperationsType  {
  getInvoiceById: Operation<{ invoiceId: string }, Stripe.Invoice>;
  search: Operation<{ 
    email?: string; 
    status?: string; 
    total?: number; 
    subscription?: string; 
    number?: string; 
    limit?: number;
    starting_after?: string;
  }, Stripe.Invoice[]>;
  list: Operation<{ 
    customer?: string;
    status?: Stripe.Invoice.Status;
    starting_after?: string;
    ending_before?: string;
    limit?: number;
    subscription?: string;
  }, Stripe.Invoice[]>;
}

/**
 * 請求関連の操作
 */
export const InvoiceOperations: InvoiceOperationsType = {
  async search(stripe: Stripe, {
    email,
    status,
    total,
    subscription,
    number,
    limit = 10,
    starting_after,
  }: {
    email?: string;
    status?: string;
    total?: number;
    subscription?: string;
    number?: string;
    limit?: number;
    starting_after?: string;
  }) {
    try {
      // 検索クエリの構築
      let queryParts = [];
      if (email) {
        queryParts.push(`email:"${email}"`);
      }
      
      // ステータスフィルター
      if (status) {
        queryParts.push(`status:"${status}"`);
      }
              
      // 請求書合計金額での検索
      if (total) {
        queryParts.push(`total:${total}`);
      }
      
      // サブスクリプションIDでの検索
      if (subscription) {
        queryParts.push(`subscription:"${subscription}"`);
      }
      
      // 請求書番号での検索
      if (number) {
        queryParts.push(`number:"${number}"`);
      }
      
      // 検索クエリが空の場合はエラーを返す
      if (queryParts.length === 0) {
        return {
          success: false,
          data: [],
          message: 'Error: 検索クエリが指定されていません。list_stripe_invoices toolを使用してください。',
        };
      }
      
      // クエリを結合
      const query = queryParts.join(' AND ');
      
      // ページネーション対応検索
      const effectiveLimit = Math.min(limit, 100); // 最大100件
      
      // 検索パラメータの構築
      const searchParams: Stripe.InvoiceSearchParams = {
        query,
        limit: effectiveLimit
      };
      
      // ページネーションパラメータの追加
      // Stripe検索APIでは、ページネーションにpageパラメータのみを使用する
      if (starting_after) {
        searchParams.page = starting_after;
      }
      
      // 検索実行
      const searchResult = await stripe.invoices.search(searchParams);
      
      return {
        success: true,
        data: searchResult.data,
        has_more: searchResult.has_more,
        next_page: searchResult.next_page,
        message: `Found ${searchResult.data.length} invoices${searchResult.has_more ? ' (more available)' : ''}.`,
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        has_more: false, 
        next_page: null,
        message: `Error searching invoices: ${error.message}`,
      };
    }
  },
  /**
   * List Stripe Invoices API wrapper
   */
  async list(stripe: Stripe, { customer, starting_after, ending_before, limit, status, subscription}: {
    customer?: string;
    status?: Stripe.Invoice.Status;
    starting_after?: string;
    ending_before?: string;
    limit?: number;
    subscription?: string;
  }) {
    try {
      // リストパラメータの構築
      const listParams: Stripe.InvoiceListParams = {
        customer,
        status,
        limit,
        subscription,
      };
      
      // ページネーションパラメータの追加
      if (starting_after) {
        listParams.starting_after = starting_after;
      } else if (ending_before) {
        listParams.ending_before = ending_before;
      }
      
      // リスト取得実行
      const listResult = await stripe.invoices.list(listParams);
      
      return {
        success: true,
        data: listResult.data,
        has_more: listResult.has_more,
        message: `Found ${listResult.data.length} invoices${listResult.has_more ? ' (more available)' : ''}.`,
      };
    } catch (error: any) {
      console.error('Error in list invoices:', error);
      return {
        success: false,
        data: [],
        message: `Error listing invoices: ${error.message}`,
      };
    }
  },
  async getInvoiceById(stripe: Stripe, options: { invoiceId: string } & BaseSearchOptions) {
    const result = await stripe.invoices.retrieve(options.invoiceId);
    return {
      success: true,
      data: result,
    }
  }
}; 