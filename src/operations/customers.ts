import Stripe from "stripe";
import { Operation } from "./interfaces.js";
import { BaseSearchOptions } from "../libs/stripeService.js";
import { logger } from "../logger.js";

// 顧客関連の操作に必要な型定義
interface CustomerOperationsType {
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
      try {
      const result = await stripe.customers.list({ email: options.email});
      if (result.data.length < 1) {
        const searchResult = await stripe.customers.search({ query: `email~"${options.email}"` });
        return {
          success: true,
          data: searchResult.data,
        }
      }
      return {
          success: true,
          data: result.data,
      }
    } catch (error) {
      logger.error(`[searchByEmail] ${error}`);
      return {
        success: false,
        error: error,
        data: []
      }
    }
    }
  };