#!/usr/bin/env node

/**
 * This is a template MCP server that implements a simple notes system.
 * It demonstrates core MCP concepts like resources, tools, and prompts.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LogLevel, MCPLogger } from "./logger.js";
import { extractStripeApiKeys } from "./libs/stripeHelpers.js";
import { StripeService } from "./libs/stripeService.js";
import { CustomerOperations, SubscriptionOperations, InvoiceOperations } from "./libs/stripeOperations.js";

import {StripeAgentToolkit} from '@stripe/agent-toolkit/langchain';
import Stripe from 'stripe';

/**
 * Type alias for a note object.
 */
type Note = { title: string, content: string };

/**
 * Simple in-memory storage for notes.
 * In a real implementation, this would likely be backed by a database.
 */
const notes: { [id: string]: Note } = {
  "1": { title: "First Note", content: "This is note 1" },
  "2": { title: "Second Note", content: "This is note 2" }
};

/**
 * Create an MCP server
 */
const server = new McpServer({
  name: "advanced-stripe-mcp-server",
  version: "0.1.0",
});


/**
 * Define notes resource
 */
server.resource(
  "notes",
  new ResourceTemplate("note:///{id}", {
    list: async () => {
      return {
        resources: Object.entries(notes).map(([id, note]) => ({
          uri: `note:///${id}`,
          mimeType: "text/plain",
          name: note.title,
          description: `A text note: ${note.title}`
        }))
      };
    }
  }),
  async (uri, params) => {
    const id = String(params.id);
    const note = notes[id];
    
    if (!note) {
      throw new Error(`Note ${id} not found`);
    }
    
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: "text/plain",
        text: note.content
      }]
    };
  }
);

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
  // 環境変数からStripe APIキーを抽出
  const stripeApiKeys = extractStripeApiKeys(process.env);
  
  // StripeServiceを初期化
  const stripeService = new StripeService({
    apiKeys: stripeApiKeys,
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
  // 環境変数からStripe APIキーを抽出
  const stripeApiKeys = extractStripeApiKeys(process.env);
  
  // StripeServiceを初期化
  const stripeService = new StripeService({
    apiKeys: stripeApiKeys,
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  
  const results = await stripeService.executeOperation(
    { email, account },
    CustomerOperations.searchByEmail
  );
  
  return stripeService.formatResponse(results);
});

server.tool(`search_subscriptions`, {
  customerId: z.string().min(1, "Customer ID is required"),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args: { customerId: string, account?: string }, extra) => {
  const { customerId, account } = args;
  logger.info(`Searching subscriptions for customer: ${customerId}, account: ${account || 'not specified'}`);
  // 環境変数からStripe APIキーを抽出
  const stripeApiKeys = extractStripeApiKeys(process.env);
  
  // StripeServiceを初期化
  const stripeService = new StripeService({
    apiKeys: stripeApiKeys,
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  
  const results = await stripeService.executeOperation(
    { customerId, account },
    SubscriptionOperations.searchByCustomerId
  );
  return stripeService.formatResponse(results);
});

server.tool(`search_invoices`, {
  customerId: z.string().optional(),
  invoiceId: z.string().optional(),
  account: z.string().optional().describe("アカウント名（例: 1st_account, 2nd_account）または「all」ですべてのアカウントを検索"),
}, async (args: { customerId?: string, invoiceId?: string,account?: string }, extra) => {
  const { customerId, account, invoiceId } = args;
  logger.info(`Searching invoices for customer: ${customerId}, account: ${account || 'not specified'}`);
  // 環境変数からStripe APIキーを抽出
  const stripeApiKeys = extractStripeApiKeys(process.env);
  
  // StripeServiceを初期化
  const stripeService = new StripeService({
    apiKeys: stripeApiKeys,
    logger: logger,
    apiVersion: STRIPE_API_VERSION
  });
  if (customerId) {
    const results = await stripeService.executeOperation(
      { customerId, account },
      InvoiceOperations.searchByCustomerId
    );
    return stripeService.formatResponse(results);
  }
  if (invoiceId) {
    const results = await stripeService.executeOperation(
      { invoiceId, account },
      InvoiceOperations.searchByInvoiceId
    );
    
    return stripeService.formatResponse(results);
  }
  return stripeService.formatResponse([{
    success: false,
    message: "customerId または invoiceId が必要です",
    accountName: account || 'not specified'
  }])
  
});

/**
 * Define create_note tool
 */
server.tool(
  "hello_world",
  {
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required")
  },
  async ({ title, content }: { title: string, content: string }) => {

    const toolkit = new StripeAgentToolkit({
      secretKey: 'sk_test_xxx',
      configuration: {
        actions: {
          customers: {
            read: true,
          }
        }
      }
    })
    const tools = toolkit.getTools()
    tools.forEach(tool => {
      
      logger.info(JSON.stringify([
        tool.method,
        tool.name,
        tool.description,
        tool.schema,
      ], null, 2))
    })


    const id = String(Object.keys(notes).length + 1);
    notes[id] = { title, content };
    
    return {
      content: [{
        type: "text",
        text: `Created note ${id}: ${title}`
      }]
    };
  }
);

/**
 * Define summarize_notes prompt
 */
server.prompt(
  "summarize_notes",
  {},
  async () => {
    const embeddedNotes = Object.entries(notes).map(([id, note]) => ({
      type: "resource" as const,
      resource: {
        uri: `note:///${id}`,
        mimeType: "text/plain",
        text: note.content
      }
    }));
    
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Please summarize the following notes:"
          }
        },
        ...embeddedNotes.map(note => ({
          role: "user" as const,
          content: note
        })),
        {
          role: "user",
          content: {
            type: "text",
            text: "Provide a concise summary of all the notes above."
          }
        }
      ]
    };
  }
);

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

