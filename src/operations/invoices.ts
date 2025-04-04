import { Operation } from "./interfaces.js";
import Stripe from "stripe";
import { BaseSearchOptions } from "../libs/stripeService.js";

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