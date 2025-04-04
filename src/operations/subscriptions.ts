import { Operation } from "./interfaces.js";
import Stripe from "stripe";
import { BaseSearchOptions } from "../libs/stripeService.js";
// サブスクリプション関連の操作に必要な型定義
interface SubscriptionOperationsType {
    search: Operation<Stripe.SubscriptionListParams, Stripe.Subscription[]>;
    searchAll: Operation<Stripe.SubscriptionListParams, Stripe.Subscription[]>;
  }
  
/**
 * サブスクリプション関連の操作
 */
export const SubscriptionOperations: SubscriptionOperationsType = {
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
  