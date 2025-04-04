#!/usr/bin/env node

/**
 * This is a template MCP server that implements a simple notes system.
 * It demonstrates core MCP concepts like resources, tools, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { logger } from "./logger.js";
import { extractStripeApiKeys } from "./libs/stripeHelpers.js";
import { StripeService } from "./libs/stripeService.js";
import { CustomerOperations } from "./operations/customers.js";
import { SubscriptionOperations } from "./operations/subscriptions.js";
import { InvoiceOperations } from "./operations/invoices.js";
import Stripe from 'stripe';

/**
 * Create an MCP server
 */
const server = new McpServer({
  name: "advanced-stripe-mcp-server",
  version: "0.1.0",
});
  

// Stripeのバージョン
const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] =  '2025-03-31.basil';

server.tool(`search_stripe_customer_by_name`, {
  name: z.string().min(1, "Name is required"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args: { name: string, account?: string }) => {
  const { name, account } = args;
  logger.info(`[search_customer] 検索開始: 名前=${name}, アカウント=${account || 'デフォルト'}`);
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  logger.info(`[search_customer] StripeService初期化完了`);
  
  logger.info(`[search_customer] 名前検索実行: ${name}`);
  const results = await stripeService.executeOperation(
    { name, account },
    CustomerOperations.searchByName
  );
  logger.info(`[search_customer] 名前検索完了: 結果数=${results?.length || 0}, 最初の数件=${JSON.stringify(results?.slice(0, 2) || [])}`);
  
  return stripeService.formatResponse(results);
});

server.tool(`search_stripe_customer_by_email`, {
  email: z.string().min(1, "Email is required"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args: { email: string, account?: string }, extra) => {
  const { email, account } = args;
  logger.info(`[search_customer_by_email] 検索開始: メール=${email}, アカウント=${account || 'デフォルト'}`);
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  logger.info(`[search_customer_by_email] StripeService初期化完了`);
  
  logger.info(`[search_customer_by_email] メールアドレス検索実行: ${email}`);
  const results = await stripeService.executeOperation(
    { email, account },
    CustomerOperations.searchByEmail
  );
  logger.info(`[search_customer_by_email] メールアドレス検索完了: 結果数=${results?.length || 0}, 最初の数件=${JSON.stringify(results?.slice(0, 2) || [])}`);
  
  return stripeService.formatResponse(results);
});

server.tool('search_stripe_subscriptions', {
  limit: z.number().optional().describe("Number of subscriptions to retrieve (default: 10, max: 100)"),   
  status: z.enum(['active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid']).optional().describe("Subscription status"),
  customer: z.string().optional().describe("Customer ID to filter by"),
  product: z.string().optional().describe("Product ID to filter by"),
  created: z.string().optional().describe("Created date in YYYY-MM-DD format"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async ({ limit, status, customer, product, created, account }) => {
  logger.info(`[search_subscriptions] 検索開始: パラメータ=${JSON.stringify({ limit, status, customer, product, created, account })}`);

  // 検索条件の設定
  const searchParams: Stripe.SubscriptionListParams = {
      limit: Math.min(limit || 10, 100),
      expand: ['data.customer', 'data.items.data.price'],
  };

  // オプションパラメータの追加
  if (status) searchParams.status = status;
  if (customer) searchParams.customer = customer;
  if (created) {
      const createdDate = new Date(created);
      searchParams.created = Math.floor(createdDate.getTime() / 1000);
      logger.info(`[search_subscriptions] createdDateを変換: ${created} → ${searchParams.created}`);
  }
  
  logger.info(`[search_subscriptions] 検索条件設定完了: ${JSON.stringify(searchParams)}`);
  
  // StripeServiceを初期化
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  logger.info(`[search_subscriptions] StripeService初期化完了: アカウント=${account || 'デフォルト'}`);

  logger.info(`[search_subscriptions] 通常検索モードで実行`);
  const results = await stripeService.executeOperation(
    { ...searchParams, account },
    SubscriptionOperations.search
  );
  logger.info(`[search_subscriptions] 通常検索完了: 結果数=${results?.length || 0}, 最初の数件=${JSON.stringify(results?.slice(0, 2) || [])}`);
  return stripeService.formatResponse(results);
});


server.tool('list_stripe_invoices', {
  subscription: z.string().optional().describe("Subscription ID to filter by"),
  customer: z.string().optional().describe("Customer ID to filter by"),
  starting_after: z.string().optional().describe("このID以降の請求書を取得（ページネーション用）"),
  ending_before: z.string().optional().describe("このID以前の請求書を取得（ページネーション用）"),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).optional().describe("Invoice status"),
  limit: z.number().optional().default(10).describe("一度に取得する請求書数（デフォルト: 10, 最大: 100）"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args) => {
  logger.info(`[list_stripe_invoices] 検索開始: パラメータ=${JSON.stringify(args)}`);

  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  const results = await stripeService.executeOperation(
    args,
    InvoiceOperations.list
  );
  return stripeService.formatResponse(results);
})

server.tool('get_stripe_invoice_by_id', {
  invoiceId: z.string().min(1, "Invoice ID is required"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args) => {
  logger.info(`[get_stripe_invoice_by_id] 検索開始: パラメータ=${JSON.stringify(args)}`);
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  const results = await stripeService.executeOperation(
    args,
    InvoiceOperations.getInvoiceById
  );
  return stripeService.formatResponse(results); 
})

server.tool('search_stripe_invoices', {
  limit: z.number().optional().describe("一度に取得する請求書数（デフォルト: 10, 最大: 100）"),
  starting_after: z.string().optional().describe("このID以降の請求書を取得（ページネーション用）"),
  customer: z.string().optional().describe("Customer ID to filter by"),
  email: z.string().optional().describe("Customer email to search for"),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).optional().describe("Invoice status"),
  total: z.number().optional().describe("Total amount of the invoice (in minor units)"),
  subscription: z.string().optional().describe("Subscription ID associated with invoices"),
  number: z.string().optional().describe("Invoice number (e.g. MYSHOP-123)"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args) => {
  logger.info(`[search_invoices] 検索開始: パラメータ=${JSON.stringify(args)}`);
  const {
    email,
    status,
    total,
    subscription,
    number,
    limit = 10,
    starting_after,
    account,
  } = args;
    
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  logger.info(`[search_invoices] StripeService初期化完了: アカウント=${account || 'デフォルト'}`);

    try {
      const results = await stripeService.executeOperation(
        { 
          email,
          status,
          total,
          subscription,
          number,
          limit,
          starting_after,
          account
        },
        InvoiceOperations.search
      );
      return stripeService.formatResponse(results);
    } catch (error: any) {
      logger.error(`[search_invoices] エラー発生: ${error.message}, スタック=${error.stack}`);
      return {
        content: [],
        error: `検索中にエラーが発生しました: ${error.message}`
      };
    }

})

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

