#!/usr/bin/env node

/**
 * Comprehensive Mautic MCP Server
 * 
 * This MCP server provides full integration with Mautic marketing automation platform.
 * It supports contact management, campaigns, emails, forms, segments, and analytics.
 * 
 * Features:
 * - OAuth2 authentication with automatic token refresh
 * - Contact CRUD operations and search
 * - Campaign management and statistics
 * - Email operations and templates
 * - Form management and submissions
 * - Segment management
 * - Analytics and reporting
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosError } from 'axios';

// Environment variables for Mautic configuration
const MAUTIC_BASE_URL = process.env.MAUTIC_BASE_URL;
const MAUTIC_CLIENT_ID = process.env.MAUTIC_CLIENT_ID;
const MAUTIC_CLIENT_SECRET = process.env.MAUTIC_CLIENT_SECRET;
const MAUTIC_TOKEN_ENDPOINT = process.env.MAUTIC_TOKEN_ENDPOINT;

if (!MAUTIC_BASE_URL || !MAUTIC_CLIENT_ID || !MAUTIC_CLIENT_SECRET || !MAUTIC_TOKEN_ENDPOINT) {
  throw new Error('Missing required Mautic environment variables: MAUTIC_BASE_URL, MAUTIC_CLIENT_ID, MAUTIC_CLIENT_SECRET, MAUTIC_TOKEN_ENDPOINT');
}

// OAuth2 token storage
interface OAuth2Token {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: string;
}

// Type definitions for Mautic API responses
interface MauticContact {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  dateAdded?: string;
  dateModified?: string;
  lastActive?: string;
  points: number;
  [key: string]: any;
}

interface MauticCampaign {
  id: number;
  name: string;
  description?: string;
  isPublished: boolean;
  publishUp?: string;
  publishDown?: string;
  dateAdded?: string;
  createdBy?: string;
  stats?: {
    sentCount: number;
    readCount: number;
    clickCount: number;
  };
}

interface MauticEmail {
  id: number;
  name: string;
  subject?: string;
  fromAddress?: string;
  fromName?: string;
  replyToAddress?: string;
  customHtml?: string;
  plainText?: string;
  template?: string;
  emailType?: string;
  publishUp?: string;
  publishDown?: string;
  readCount?: number;
  sentCount?: number;
  revision?: number;
  assetAttachments?: any[];
  variantStartDate?: string;
  variantSentCount?: number;
  variantReadCount?: number;
  variantClickCount?: number;
  variantUnsubscribedCount?: number;
  variantBounceCount?: number;
}

interface MauticForm {
  id: number;
  name: string;
  alias?: string;
  description?: string;
  isPublished: boolean;
  publishUp?: string;
  publishDown?: string;
  dateAdded?: string;
  createdBy?: string;
  submissionCount?: number;
  fields?: any[];
}

interface MauticSegment {
  id: number;
  name: string;
  alias?: string;
  description?: string;
  isPublished: boolean;
  isGlobal: boolean;
  filters?: any[];
  dateAdded?: string;
  createdBy?: string;
}

class MauticServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private token: OAuth2Token | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "mautic-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: MAUTIC_BASE_URL,
      timeout: 30000,
    });

    this.setupAxiosInterceptors();
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupAxiosInterceptors() {
    // Request interceptor to add authorization header
    this.axiosInstance.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token.access_token}`;
      }
      return config;
    });

    // Response interceptor to handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && this.token?.refresh_token) {
          try {
            await this.refreshToken();
            // Retry the original request
            const originalRequest = error.config;
            if (originalRequest) {
              originalRequest.headers.Authorization = `Bearer ${this.token?.access_token}`;
              return this.axiosInstance.request(originalRequest);
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async ensureValidToken() {
    if (!this.token || Date.now() >= this.token.expires_at) {
      if (this.token?.refresh_token) {
        await this.refreshToken();
      } else {
        await this.getAccessToken();
      }
    }
  }

  private async getAccessToken() {
    try {
      const response = await axios.post(MAUTIC_TOKEN_ENDPOINT!, {
        grant_type: 'client_credentials',
        client_id: MAUTIC_CLIENT_ID,
        client_secret: MAUTIC_CLIENT_SECRET,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.token = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at: Date.now() + (response.data.expires_in * 1000) - 60000, // 1 minute buffer
        token_type: response.data.token_type || 'Bearer',
      };
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw new McpError(ErrorCode.InternalError, 'Failed to authenticate with Mautic API');
    }
  }

  private async refreshToken() {
    if (!this.token?.refresh_token) {
      await this.getAccessToken();
      return;
    }

    try {
      const response = await axios.post(MAUTIC_TOKEN_ENDPOINT!, {
        grant_type: 'refresh_token',
        refresh_token: this.token.refresh_token,
        client_id: MAUTIC_CLIENT_ID,
        client_secret: MAUTIC_CLIENT_SECRET,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.token = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || this.token.refresh_token,
        expires_at: Date.now() + (response.data.expires_in * 1000) - 60000,
        token_type: response.data.token_type || 'Bearer',
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await this.getAccessToken();
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Contact Management Tools
        {
          name: 'create_contact',
          description: 'Create a new contact in Mautic',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'Contact email address' },
              firstName: { type: 'string', description: 'First name' },
              lastName: { type: 'string', description: 'Last name' },
              phone: { type: 'string', description: 'Phone number' },
              company: { type: 'string', description: 'Company name' },
              position: { type: 'string', description: 'Job position' },
              customFields: { type: 'object', description: 'Custom field values' },
            },
            required: ['email'],
          },
        },
        {
          name: 'update_contact',
          description: 'Update an existing contact',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Contact ID' },
              email: { type: 'string', description: 'Contact email address' },
              firstName: { type: 'string', description: 'First name' },
              lastName: { type: 'string', description: 'Last name' },
              phone: { type: 'string', description: 'Phone number' },
              company: { type: 'string', description: 'Company name' },
              position: { type: 'string', description: 'Job position' },
              customFields: { type: 'object', description: 'Custom field values' },
            },
            required: ['id'],
          },
        },
        {
          name: 'get_contact',
          description: 'Get contact details by ID or email',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Contact ID' },
              email: { type: 'string', description: 'Contact email address' },
            },
          },
        },
        {
          name: 'search_contacts',
          description: 'Search contacts with filters and pagination',
          inputSchema: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Search term' },
              limit: { type: 'number', description: 'Number of results (max 200)', maximum: 200 },
              start: { type: 'number', description: 'Starting offset for pagination' },
              orderBy: { type: 'string', description: 'Field to order by' },
              orderByDir: { type: 'string', enum: ['ASC', 'DESC'], description: 'Order direction' },
              publishedOnly: { type: 'boolean', description: 'Only published contacts' },
              minimal: { type: 'boolean', description: 'Return minimal contact data' },
            },
          },
        },
        {
          name: 'delete_contact',
          description: 'Delete a contact from Mautic',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Contact ID to delete' },
            },
            required: ['id'],
          },
        },
        {
          name: 'add_contact_to_segment',
          description: 'Add a contact to a specific segment',
          inputSchema: {
            type: 'object',
            properties: {
              contactId: { type: 'number', description: 'Contact ID' },
              segmentId: { type: 'number', description: 'Segment ID' },
            },
            required: ['contactId', 'segmentId'],
          },
        },

        // Campaign Management Tools
        {
          name: 'list_campaigns',
          description: 'Get all campaigns with status and statistics',
          inputSchema: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Search term' },
              limit: { type: 'number', description: 'Number of results', maximum: 200 },
              start: { type: 'number', description: 'Starting offset' },
              publishedOnly: { type: 'boolean', description: 'Only published campaigns' },
            },
          },
        },
        {
          name: 'get_campaign',
          description: 'Get detailed campaign information',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Campaign ID' },
            },
            required: ['id'],
          },
        },
        {
          name: 'create_campaign',
          description: 'Create a new campaign',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Campaign name' },
              description: { type: 'string', description: 'Campaign description' },
              isPublished: { type: 'boolean', description: 'Publish immediately' },
              publishUp: { type: 'string', description: 'Publish start date (YYYY-MM-DD HH:MM:SS)' },
              publishDown: { type: 'string', description: 'Publish end date (YYYY-MM-DD HH:MM:SS)' },
            },
            required: ['name'],
          },
        },
        {
          name: 'add_contact_to_campaign',
          description: 'Add a contact to a campaign',
          inputSchema: {
            type: 'object',
            properties: {
              campaignId: { type: 'number', description: 'Campaign ID' },
              contactId: { type: 'number', description: 'Contact ID' },
            },
            required: ['campaignId', 'contactId'],
          },
        },

        // Email Management Tools
        {
          name: 'send_email',
          description: 'Send an email to specific contacts',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'number', description: 'Email template ID' },
              contactIds: { type: 'array', items: { type: 'number' }, description: 'Array of contact IDs' },
              contactEmails: { type: 'array', items: { type: 'string' }, description: 'Array of contact emails' },
            },
          },
        },
        {
          name: 'list_emails',
          description: 'Get all email templates and campaigns',
          inputSchema: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Search term' },
              limit: { type: 'number', description: 'Number of results', maximum: 200 },
              start: { type: 'number', description: 'Starting offset' },
              publishedOnly: { type: 'boolean', description: 'Only published emails' },
            },
          },
        },
        {
          name: 'get_email',
          description: 'Get detailed email information',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Email ID' },
            },
            required: ['id'],
          },
        },
        {
          name: 'create_email_template',
          description: 'Create a new email template',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Email name' },
              subject: { type: 'string', description: 'Email subject' },
              fromAddress: { type: 'string', description: 'From email address' },
              fromName: { type: 'string', description: 'From name' },
              replyToAddress: { type: 'string', description: 'Reply-to email address' },
              customHtml: { type: 'string', description: 'HTML content' },
              plainText: { type: 'string', description: 'Plain text content' },
              emailType: { type: 'string', enum: ['template', 'list'], description: 'Email type' },
              isPublished: { type: 'boolean', description: 'Publish immediately' },
            },
            required: ['name', 'subject'],
          },
        },

        // Form Management Tools
        {
          name: 'list_forms',
          description: 'Get all forms with submission counts',
          inputSchema: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Search term' },
              limit: { type: 'number', description: 'Number of results', maximum: 200 },
              start: { type: 'number', description: 'Starting offset' },
              publishedOnly: { type: 'boolean', description: 'Only published forms' },
            },
          },
        },
        {
          name: 'get_form',
          description: 'Get form details and fields',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Form ID' },
            },
            required: ['id'],
          },
        },
        {
          name: 'get_form_submissions',
          description: 'Get form submission data',
          inputSchema: {
            type: 'object',
            properties: {
              formId: { type: 'number', description: 'Form ID' },
              limit: { type: 'number', description: 'Number of results', maximum: 200 },
              start: { type: 'number', description: 'Starting offset' },
              dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
              dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
            },
            required: ['formId'],
          },
        },

        // Segment Management Tools
        {
          name: 'list_segments',
          description: 'Get all contact segments',
          inputSchema: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Search term' },
              limit: { type: 'number', description: 'Number of results', maximum: 200 },
              start: { type: 'number', description: 'Starting offset' },
              publishedOnly: { type: 'boolean', description: 'Only published segments' },
            },
          },
        },
        {
          name: 'create_segment',
          description: 'Create a new contact segment',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Segment name' },
              alias: { type: 'string', description: 'Segment alias' },
              description: { type: 'string', description: 'Segment description' },
              isPublished: { type: 'boolean', description: 'Publish immediately' },
              isGlobal: { type: 'boolean', description: 'Global segment' },
              filters: { type: 'array', description: 'Segment filters' },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_segment_contacts',
          description: 'Get contacts in a specific segment',
          inputSchema: {
            type: 'object',
            properties: {
              segmentId: { type: 'number', description: 'Segment ID' },
              limit: { type: 'number', description: 'Number of results', maximum: 200 },
              start: { type: 'number', description: 'Starting offset' },
            },
            required: ['segmentId'],
          },
        },

        // Analytics and Reporting Tools
        {
          name: 'get_contact_activity',
          description: 'Get contact interaction history',
          inputSchema: {
            type: 'object',
            properties: {
              contactId: { type: 'number', description: 'Contact ID' },
              search: { type: 'string', description: 'Search term' },
              includeEvents: { type: 'array', items: { type: 'string' }, description: 'Event types to include' },
              excludeEvents: { type: 'array', items: { type: 'string' }, description: 'Event types to exclude' },
              dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
              dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
              limit: { type: 'number', description: 'Number of results', maximum: 200 },
            },
            required: ['contactId'],
          },
        },
        {
          name: 'get_email_stats',
          description: 'Get email performance statistics',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'number', description: 'Email ID' },
            },
            required: ['emailId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          // Contact Management
          case 'create_contact':
            return await this.createContact(request.params.arguments);
          case 'update_contact':
            return await this.updateContact(request.params.arguments);
          case 'get_contact':
            return await this.getContact(request.params.arguments);
          case 'search_contacts':
            return await this.searchContacts(request.params.arguments);
          case 'delete_contact':
            return await this.deleteContact(request.params.arguments);
          case 'add_contact_to_segment':
            return await this.addContactToSegment(request.params.arguments);

          // Campaign Management
          case 'list_campaigns':
            return await this.listCampaigns(request.params.arguments);
          case 'get_campaign':
            return await this.getCampaign(request.params.arguments);
          case 'create_campaign':
            return await this.createCampaign(request.params.arguments);
          case 'add_contact_to_campaign':
            return await this.addContactToCampaign(request.params.arguments);

          // Email Management
          case 'send_email':
            return await this.sendEmail(request.params.arguments);
          case 'list_emails':
            return await this.listEmails(request.params.arguments);
          case 'get_email':
            return await this.getEmail(request.params.arguments);
          case 'create_email_template':
            return await this.createEmailTemplate(request.params.arguments);

          // Form Management
          case 'list_forms':
            return await this.listForms(request.params.arguments);
          case 'get_form':
            return await this.getForm(request.params.arguments);
          case 'get_form_submissions':
            return await this.getFormSubmissions(request.params.arguments);

          // Segment Management
          case 'list_segments':
            return await this.listSegments(request.params.arguments);
          case 'create_segment':
            return await this.createSegment(request.params.arguments);
          case 'get_segment_contacts':
            return await this.getSegmentContacts(request.params.arguments);

          // Analytics
          case 'get_contact_activity':
            return await this.getContactActivity(request.params.arguments);
          case 'get_email_stats':
            return await this.getEmailStats(request.params.arguments);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        if (axios.isAxiosError(error)) {
          const message = error.response?.data?.errors?.[0]?.message || 
                          error.response?.data?.error?.message || 
                          error.message;
          return {
            content: [{ type: 'text', text: `Mautic API Error: ${message}` }],
            isError: true,
          };
        }
        throw new McpError(ErrorCode.InternalError, `Unexpected error: ${error}`);
      }
    });
  }

  // Contact Management Methods
  private async createContact(args: any) {
    const response = await this.axiosInstance.post('/contacts/new', args);
    return {
      content: [{ 
        type: 'text', 
        text: `Contact created successfully:\n${JSON.stringify(response.data.contact, null, 2)}` 
      }],
    };
  }

  private async updateContact(args: any) {
    const { id, ...updateData } = args;
    const response = await this.axiosInstance.patch(`/contacts/${id}/edit`, updateData);
    return {
      content: [{ 
        type: 'text', 
        text: `Contact updated successfully:\n${JSON.stringify(response.data.contact, null, 2)}` 
      }],
    };
  }

  private async getContact(args: any) {
    const { id, email } = args;
    let response;
    
    if (id) {
      response = await this.axiosInstance.get(`/contacts/${id}`);
    } else if (email) {
      const searchResponse = await this.axiosInstance.get('/contacts', {
        params: { search: `email:${email}`, limit: 1 }
      });
      if (searchResponse.data.total === 0) {
        return {
          content: [{ type: 'text', text: `No contact found with email: ${email}` }],
        };
      }
      const contactId = Object.keys(searchResponse.data.contacts)[0];
      response = await this.axiosInstance.get(`/contacts/${contactId}`);
    } else {
      throw new McpError(ErrorCode.InvalidParams, 'Either id or email must be provided');
    }

    return {
      content: [{ 
        type: 'text', 
        text: `Contact details:\n${JSON.stringify(response.data.contact, null, 2)}` 
      }],
    };
  }

  private async searchContacts(args: any) {
    const params: any = {};
    if (args?.search) params.search = args.search;
    if (args?.limit) params.limit = Math.min(args.limit, 200);
    if (args?.start) params.start = args.start;
    if (args?.orderBy) params.orderBy = args.orderBy;
    if (args?.orderByDir) params.orderByDir = args.orderByDir;
    if (args?.publishedOnly) params.publishedOnly = args.publishedOnly;
    if (args?.minimal) params.minimal = args.minimal;

    const response = await this.axiosInstance.get('/contacts', { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${response.data.total} contacts:\n${JSON.stringify(response.data.contacts, null, 2)}` 
      }],
    };
  }

  private async deleteContact(args: any) {
    const { id } = args;
    await this.axiosInstance.delete(`/contacts/${id}/delete`);
    return {
      content: [{ type: 'text', text: `Contact ${id} deleted successfully` }],
    };
  }

  private async addContactToSegment(args: any) {
    const { contactId, segmentId } = args;
    const response = await this.axiosInstance.post(`/segments/${segmentId}/contact/${contactId}/add`);
    return {
      content: [{ 
        type: 'text', 
        text: `Contact ${contactId} added to segment ${segmentId} successfully` 
      }],
    };
  }

  // Campaign Management Methods
  private async listCampaigns(args: any) {
    const params: any = {};
    if (args?.search) params.search = args.search;
    if (args?.limit) params.limit = Math.min(args.limit, 200);
    if (args?.start) params.start = args.start;
    if (args?.publishedOnly) params.publishedOnly = args.publishedOnly;

    const response = await this.axiosInstance.get('/campaigns', { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${response.data.total} campaigns:\n${JSON.stringify(response.data.campaigns, null, 2)}` 
      }],
    };
  }

  private async getCampaign(args: any) {
    const { id } = args;
    const response = await this.axiosInstance.get(`/campaigns/${id}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Campaign details:\n${JSON.stringify(response.data.campaign, null, 2)}` 
      }],
    };
  }

  private async createCampaign(args: any) {
    const response = await this.axiosInstance.post('/campaigns/new', args);
    return {
      content: [{ 
        type: 'text', 
        text: `Campaign created successfully:\n${JSON.stringify(response.data.campaign, null, 2)}` 
      }],
    };
  }

  private async addContactToCampaign(args: any) {
    const { campaignId, contactId } = args;
    const response = await this.axiosInstance.post(`/campaigns/${campaignId}/contact/${contactId}/add`);
    return {
      content: [{ 
        type: 'text', 
        text: `Contact ${contactId} added to campaign ${campaignId} successfully` 
      }],
    };
  }

  // Email Management Methods
  private async sendEmail(args: any) {
    const { emailId, contactIds, contactEmails } = args;
    const data: any = { id: emailId };
    
    if (contactIds) data.contactIds = contactIds;
    if (contactEmails) data.contactEmails = contactEmails;

    const response = await this.axiosInstance.post(`/emails/${emailId}/contact/send`, data);
    return {
      content: [{ 
        type: 'text', 
        text: `Email sent successfully:\n${JSON.stringify(response.data, null, 2)}` 
      }],
    };
  }

  private async listEmails(args: any) {
    const params: any = {};
    if (args?.search) params.search = args.search;
    if (args?.limit) params.limit = Math.min(args.limit, 200);
    if (args?.start) params.start = args.start;
    if (args?.publishedOnly) params.publishedOnly = args.publishedOnly;

    const response = await this.axiosInstance.get('/emails', { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${response.data.total} emails:\n${JSON.stringify(response.data.emails, null, 2)}` 
      }],
    };
  }

  private async getEmail(args: any) {
    const { id } = args;
    const response = await this.axiosInstance.get(`/emails/${id}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Email details:\n${JSON.stringify(response.data.email, null, 2)}` 
      }],
    };
  }

  private async createEmailTemplate(args: any) {
    const response = await this.axiosInstance.post('/emails/new', args);
    return {
      content: [{ 
        type: 'text', 
        text: `Email template created successfully:\n${JSON.stringify(response.data.email, null, 2)}` 
      }],
    };
  }

  // Form Management Methods
  private async listForms(args: any) {
    const params: any = {};
    if (args?.search) params.search = args.search;
    if (args?.limit) params.limit = Math.min(args.limit, 200);
    if (args?.start) params.start = args.start;
    if (args?.publishedOnly) params.publishedOnly = args.publishedOnly;

    const response = await this.axiosInstance.get('/forms', { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${response.data.total} forms:\n${JSON.stringify(response.data.forms, null, 2)}` 
      }],
    };
  }

  private async getForm(args: any) {
    const { id } = args;
    const response = await this.axiosInstance.get(`/forms/${id}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Form details:\n${JSON.stringify(response.data.form, null, 2)}` 
      }],
    };
  }

  private async getFormSubmissions(args: any) {
    const { formId, limit, start, dateFrom, dateTo } = args;
    const params: any = {};
    if (limit) params.limit = Math.min(limit, 200);
    if (start) params.start = start;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const response = await this.axiosInstance.get(`/forms/${formId}/submissions`, { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${response.data.total} form submissions:\n${JSON.stringify(response.data.submissions, null, 2)}` 
      }],
    };
  }

  // Segment Management Methods
  private async listSegments(args: any) {
    const params: any = {};
    if (args?.search) params.search = args.search;
    if (args?.limit) params.limit = Math.min(args.limit, 200);
    if (args?.start) params.start = args.start;
    if (args?.publishedOnly) params.publishedOnly = args.publishedOnly;

    const response = await this.axiosInstance.get('/segments', { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${response.data.total} segments:\n${JSON.stringify(response.data.lists, null, 2)}` 
      }],
    };
  }

  private async createSegment(args: any) {
    const response = await this.axiosInstance.post('/segments/new', args);
    return {
      content: [{ 
        type: 'text', 
        text: `Segment created successfully:\n${JSON.stringify(response.data.list, null, 2)}` 
      }],
    };
  }

  private async getSegmentContacts(args: any) {
    const { segmentId, limit, start } = args;
    const params: any = {};
    if (limit) params.limit = Math.min(limit, 200);
    if (start) params.start = start;

    const response = await this.axiosInstance.get(`/segments/${segmentId}/contacts`, { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Found ${response.data.total} contacts in segment:\n${JSON.stringify(response.data.contacts, null, 2)}` 
      }],
    };
  }

  // Analytics Methods
  private async getContactActivity(args: any) {
    const { contactId, search, includeEvents, excludeEvents, dateFrom, dateTo, limit } = args;
    const params: any = {};
    if (search) params.search = search;
    if (includeEvents) params.includeEvents = includeEvents;
    if (excludeEvents) params.excludeEvents = excludeEvents;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (limit) params.limit = Math.min(limit, 200);

    const response = await this.axiosInstance.get(`/contacts/${contactId}/activity`, { params });
    return {
      content: [{ 
        type: 'text', 
        text: `Contact activity:\n${JSON.stringify(response.data.events, null, 2)}` 
      }],
    };
  }

  private async getEmailStats(args: any) {
    const { emailId } = args;
    const response = await this.axiosInstance.get(`/emails/${emailId}/stats`);
    return {
      content: [{ 
        type: 'text', 
        text: `Email statistics:\n${JSON.stringify(response.data.stats, null, 2)}` 
      }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Mautic MCP server running on stdio');
  }
}

const server = new MauticServer();
server.run().catch(console.error);
