/**
 * Stripe API操作の具体的な実装
 * StripeServiceから分離し、各操作の実装を管理します
 */

import Stripe from 'stripe';
import { BaseSearchOptions } from './stripeService.js';

/**
 * 顧客関連の操作
 */
export class CustomerOperations {
  /**
   * 顧客を名前で検索
   */
  static async searchByName(stripe: Stripe, options: { name: string } & BaseSearchOptions) {

    const result = await stripe.customers.search({
        query: `name~"${options.name}"`
    });
    
    return { 
      success: true, 
      data: result.data,
    };
  }

  /**
   * 顧客をメールアドレスで検索
   */
  static async searchByEmail(stripe: Stripe, options: { email: string } & BaseSearchOptions) {
    const result = await stripe.customers.list({ email: options.email});
    return {
        success: true,
        data: result.data,
    }
  }
}

/**
 * サブスクリプション関連の操作
 */
export class SubscriptionOperations {
  /**
   * サブスクリプションを顧客IDで検索
   */
  static async searchByCustomerId(stripe: Stripe, options: { customerId: string } & BaseSearchOptions) {
    const result = await stripe.subscriptions.list({ customer: options.customerId})
    return {
      success: true,
      data: result.data,
    }
    // 実際のAPI呼び出し
    // const result = await stripe.subscriptions.list({ customer: options.customerId });
    // return result;
    
    // 実装は省略し、成功したことにする
    return { 
      success: true, 
      message: `顧客ID "${options.customerId}" のサブスクリプションを検索しました。（実際のAPI呼び出しはまだ実装されていません）` 
    };
  }
}

/**
 * 請求関連の操作
 */
export class InvoiceOperations {
  /**
   * 請求書を顧客IDで検索
   */
  static async searchByCustomerId(stripe: Stripe, options: { customerId: string } & BaseSearchOptions) {
    const result = await stripe.invoices.list({ customer: options.customerId });
    return { 
      success: true, 
      data: result.data,
    };
  }
  static async searchByInvoiceId(stripe: Stripe, options: { invoiceId: string } & BaseSearchOptions) {
    const result = await stripe.invoices.retrieve(options.invoiceId);
    return {
      success: true,
      data: result,
    }
  }
} 