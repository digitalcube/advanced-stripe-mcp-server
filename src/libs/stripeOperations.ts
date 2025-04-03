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
interface InvoiceOperationsType extends BaseOperations {
  searchByCustomerId: Operation<{ customerId: string; fetchAll?: boolean }, Stripe.Invoice[]>;
  searchByInvoiceId: Operation<{ invoiceId: string }, Stripe.Invoice>;
  search: Operation<Stripe.InvoiceListParams, Stripe.Invoice[]>;
  list: Operation<Stripe.InvoiceListParams & { fetchAll?: boolean }, Stripe.Invoice[]>;
}

/**
 * 請求関連の操作
 */
export const InvoiceOperations: InvoiceOperationsType = {
  /**
   * 請求書を顧客IDで検索
   */
  async searchByCustomerId(stripe: Stripe, options: { customerId: string; fetchAll?: boolean } & BaseSearchOptions) {
    const query: Stripe.InvoiceListParams = { customer: options.customerId };
    const result: Stripe.Invoice[] = [];
    for await (const item of stripe.invoices.list(query)) {
      result.push(item)
      if (!options.fetchAll && result.length >= 100) {
        break;
      }
    }
    return { 
      success: true, 
      data: result,
    };
  },
  async search(stripe: Stripe, {
    email,
    status,
    total,
    subscription,
    number,
    fetchAll = false,
  }: {
    email?: string;
    status?: string;
    total?: number;
    subscription?: string;
    number?: string;
    fetchAll?: boolean;
  }) {
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
    
    // 検索クエリが空の場合はデフォルトですべての請求書を検索
    const query = queryParts.length > 0 ? queryParts.join(' AND ') : '';

    const result: Stripe.Invoice[] = []
    for await (const item of stripe.invoices.search({
      query,
      limit: 100,
    })) {
      result.push(item)
      if (!fetchAll && result.length >= 100) {
        break;
      }
    }
    return {  
      success: true,
      data: result,
      message: `Found ${result.length} invoices. If you need to search more than 100, please set fetchAll as true.`,
    }
  },
  async list(stripe: Stripe, options: Stripe.InvoiceListParams & {
    fetchAll?: boolean;
  }) {
    const result: Stripe.Invoice[] = []
    for await (const item of stripe.invoices.list({...options, limit: 20})) {
      result.push(item)
      if (!options.fetchAll && result.length >= 100) {
        break;
      }
    }
    return {
      success: true,
      data: result,
      message: `Found ${result.length} invoices. If you need to search more than 100, please set fetchAll as true.`,
    }
  },
  async searchByInvoiceId(stripe: Stripe, options: { invoiceId: string } & BaseSearchOptions) {
    const result = await stripe.invoices.retrieve(options.invoiceId);
    return {
      success: true,
      data: result,
    }
  }
}; 