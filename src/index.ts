#!/usr/bin/env node

/**
 * This is a template MCP server that implements a simple notes system.
 * It demonstrates core MCP concepts like resources, tools, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LogLevel, MCPLogger } from "./logger.js";
import { extractStripeApiKeys } from "./libs/stripeHelpers.js";
import { StripeService } from "./libs/stripeService.js";
import { CustomerOperations, SubscriptionOperations, InvoiceOperations } from "./libs/stripeOperations.js";
import Stripe from 'stripe';

/**
 * Create an MCP server
 */
const server = new McpServer({
  name: "advanced-stripe-mcp-server",
  version: "0.1.0",
});

const logger = new MCPLogger({
  level: LogLevel.INFO,
});

// Stripeのバージョン
const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] =  '2025-03-31.basil';

server.tool(`search_customer`, {
  name: z.string().min(1, "Name is required"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args: { name: string, account?: string }, extra) => {
  const { name, account } = args;
  logger.info(`Searching customer with name: ${name}, account: ${account || 'not specified'}`);
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  
  const results = await stripeService.executeOperation(
    { name, account },
    CustomerOperations.searchByName
  );
  
  return stripeService.formatResponse(results);
});

server.tool(`search_customer_by_email`, {
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args: { email: string, account?: string }, extra) => {
  const { email, account } = args;
  logger.info(`Searching customer with email: ${email}, account: ${account || 'not specified'}`);
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  
  const results = await stripeService.executeOperation(
    { email, account },
    CustomerOperations.searchByEmail
  );
  
  return stripeService.formatResponse(results);
});

server.tool(`search_subscription_by_customer`, {
  customerId: z.string().min(1, "Customer ID is required"),
  fetchAll: z.boolean().optional().describe("全てのサブスクリプションを取得するかどうか"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args: { customerId: string, account?: string, fetchAll?: boolean }, extra) => {
  const { customerId, account, fetchAll } = args;
  logger.info(`Searching subscriptions for customer: ${customerId}, account: ${account || 'not specified'}`);
  
  // StripeServiceを初期化
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  if (fetchAll) {
    const results = await stripeService.executeOperation(
      { customer: customerId, account },
      SubscriptionOperations.searchAll
    );
    return stripeService.formatResponse(results);
  }
  const results = await stripeService.executeOperation(
    { customerId, account },
    SubscriptionOperations.searchByCustomerId
  );
  return stripeService.formatResponse(results);
});

server.tool('search_subscriptions', {
  limit: z.number().optional().describe("Number of subscriptions to retrieve (default: 10, max: 100)"),   
  status: z.enum(['active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid']).optional().describe("Subscription status"),
  customer: z.string().optional().describe("Customer ID to filter by"),
  product: z.string().optional().describe("Product ID to filter by"),
  created: z.string().optional().describe("Created date in YYYY-MM-DD format"),
  fetchAll: z.boolean().optional().describe("全てのサブスクリプションを取得するかどうか"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async ({ limit, status, customer, product, created, fetchAll, account }) => {
  // 検索条件の設定
  const searchParams: Stripe.SubscriptionListParams = {
      limit: fetchAll ? 100 : Math.min(limit || 10, 100), // 全件取得の場合は100件ずつ、それ以外はlimitまたはデフォルト10件
      expand: ['data.customer', 'data.items.data.price'],
  };

  // オプションパラメータの追加
  if (status) searchParams.status = status;
  if (customer) searchParams.customer = customer;
  if (created) {
      const createdDate = new Date(created);
      searchParams.created = Math.floor(createdDate.getTime() / 1000);
  }
  logger.info(`Searching subscriptions by: ${JSON.stringify(searchParams)}, account: ${account || 'not specified'}`);
  
  // StripeServiceを初期化
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  if (fetchAll) {
    const results = await stripeService.executeOperation(
      { ...searchParams, account },
      SubscriptionOperations.searchAll
    );
    return stripeService.formatResponse(results);
  }
  const results = await stripeService.executeOperation(
    { ...searchParams, account },
    SubscriptionOperations.search
  );
  return stripeService.formatResponse(results);
});

server.tool('get_invoice_by_id', {
  invoiceId: z.string().min(1, "Invoice ID is required"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async ({invoiceId, account}) => {

  // 環境変数からStripe APIキーを抽出
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  const results = await stripeService.executeOperation(
    { invoiceId, account },
    InvoiceOperations.searchByInvoiceId
  );
  
  return stripeService.formatResponse(results);
})

server.tool('list_invoices', {
  fetchAll: z.boolean().optional().describe("全ての請求書を取得するかどうか"),
  dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format"),
  customer: z.string().optional().describe("Customer ID to filter by"),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).optional().describe("Invoice status"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async ({ fetchAll, account, dueDate, customer, status }) => {
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  const results = await stripeService.executeOperation(
    { fetchAll, account, dueDate, customer, status },
    InvoiceOperations.list
  );
  return stripeService.formatResponse(results);
})



server.tool('search_invoice', {
  email: z.string().optional().describe("Customer email to search for"),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).optional().describe("Invoice status"),
  total: z.number().optional().describe("Total amount of the invoice (in minor units)"),
  subscription: z.string().optional().describe("Subscription ID associated with invoices"),
  fetchAll: z.boolean().optional().describe("全てのサブスクリプションを取得するかどうか"),
  number: z.string().optional().describe("Invoice number (e.g. MYSHOP-123)"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async ({ email, status, total, subscription, account, fetchAll, number }) => {
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });

  const results = await stripeService.executeOperation(
    { email, status, total, subscription, number, account, fetchAll },
    InvoiceOperations.search
  );
  return stripeService.formatResponse(results);
})

server.tool(`search_invoices_by_customer`, {
  customerId: z.string().min(1, "Customer ID is required"),
  fetchAll: z.boolean().optional().describe("全ての請求書を取得するかどうか"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args) => {
  const { customerId, account,  fetchAll } = args;
  logger.info(`Searching invoices for customer: ${customerId}, account: ${account || 'not specified'}`);
  // 環境変数からStripe APIキーを抽出
  const stripeService = new StripeService({
    apiKeys: extractStripeApiKeys(process.env),
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });

  if (fetchAll) {
    const results = await stripeService.executeOperation(
      { customer: customerId, account, fetchAll },
      InvoiceOperations.list
    );
    return stripeService.formatResponse(results);
  }
  const results = await stripeService.executeOperation(
    { customerId, account, fetchAll },
    InvoiceOperations.searchByCustomerId
  );
  return stripeService.formatResponse(results);
});

/**
 * @todo
 * - product
 * - price
 * - balance transaction
 * - dispute
 */


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

