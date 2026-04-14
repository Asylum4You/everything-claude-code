/**
 * Email service core types and interfaces.
 * @module EmailService
 * @description Defines the contract for email service implementations.
 */

/**
 * Represents an email address with optional display name.
 */
export interface EmailAddress {
  /** Email address (e.g., user@example.com) */
  address: string;
  /** Display name (optional) */
  name?: string;
}

/**
 * Represents an email attachment.
 */
export interface EmailAttachment {
  /** Filename of the attachment */
  filename: string;
  /** Content type (e.g., 'application/pdf', 'image/png') */
  contentType: string;
  /** Base64 encoded content or data URI */
  content: string;
  /** Disposition (default: 'attachment') */
  disposition?: string;
}

/**
 * Represents an email header.
 */
export interface EmailHeader {
  /** Header name (e.g., 'Reply-To', 'Cc') */
  name: string;
  /** Header value */
  value: string;
}

/**
 * Email message object.
 */
export interface EmailMessage {
  /** From address */
  from: EmailAddress;
  /** To recipients (array of EmailAddress) */
  to: EmailAddress[];
  /** CC recipients (optional) */
  cc?: EmailAddress[];
  /** BCC recipients (optional) */
  bcc?: EmailAddress[];
  /** Subject line */
  subject: string;
  /** Plain text version of the email */
  text: string;
  /** HTML version of the email (optional) */
  html?: string;
  /** Attachments (optional) */
  attachments?: EmailAttachment[];
  /** Custom headers (optional) */
  headers?: EmailHeader[];
  /** Reply-To address (optional) */
  replyTo?: EmailAddress[];
}

/**
 * Configuration options for email service.
 */
export interface EmailServiceConfig {
  /** Primary email service provider (e.g., 'resend', 'sendgrid', 'ses') */
  provider: string;
  /** API key for the email service */
  apiKey: string;
  /** From email address to use as default */
  defaultFrom?: EmailAddress;
  /** Whether to enable sandbox mode (for testing) */
  sandbox?: boolean;
  /** Maximum number of retries on failure (default: 3) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable/disable tracking (provider-specific) */
  tracking?: {
    clicks?: boolean;
    opens?: boolean;
  };
}

/**
 * Options for sending an email.
 */
export interface SendEmailOptions {
  /** Force provider to use (overrides config) */
  provider?: string;
  /** Skip certain validations (use with caution) */
  skipValidation?: boolean;
  /** Callback URL for webhooks (provider-specific) */
  callbackUrl?: string;
}

/**
 * Result of a sent email.
 */
export interface SendEmailResult {
  /** Unique message ID from the provider */
  messageId: string;
  /** Provider used to send the email */
  provider: string;
  /** Timestamp when email was sent */
  timestamp: Date;
  /** Status of the send operation */
  success: boolean;
  /** Any additional data from the provider */
  data?: Record<string, any>;
}

/**
 * Error types for email service operations.
 */
export enum EmailErrorType {
  /** Invalid input data (e.g., malformed email address) */
  ValidationError = 'validation_error',
  /** Authentication failed (invalid API key) */
  AuthenticationError = 'authentication_error',
  /** Insufficient permissions */
  AuthorizationError = 'authorization_error',
  /** Email provider rate limit exceeded */
  RateLimitError = 'rate_limit_error',
  /** Service unavailable or internal server error */
  ServiceError = 'service_error',
  /** Network or connection error */
  NetworkError = 'network_error',
  /** Timeout waiting for provider response */
  TimeoutError = 'timeout_error',
  /** Provider-specific error */
  ProviderError = 'provider_error',
  /** Configuration error (e.g., missing required setting) */
  ConfigurationError = 'configuration_error',
}

/**
 * Base error for email service operations.
 */
export class EmailError extends Error {
  /** Error type */
  type: EmailErrorType;
  /** HTTP status code (if applicable) */
  status?: number;
  /** Provider-specific error code */
  providerCode?: string;
  /** Original error (if any) */
  cause?: Error;

  constructor(
    message: string,
    type: EmailErrorType,
    status?: number,
    providerCode?: string,
    cause?: Error
  ) {
    super(message);
    this.type = type;
    this.status = status;
    this.providerCode = providerCode;
    this.cause = cause;
    this.name = 'EmailError';
  }
}

/**
 * Interface for email service implementations.
 * All email service providers must implement this interface.
 */
export interface EmailService {
  /**
   * Initialize the email service with configuration.
   * @param config - Email service configuration
   * @throws {EmailError} If configuration is invalid
   */
  initialize(config: EmailServiceConfig): Promise<void>;

  /**
   * Send an email message.
   * @param message - Email message to send
   * @param options - Send options (optional)
   * @returns {Promise<SendEmailResult>} Result of the send operation
   * @throws {EmailError} If sending fails
   */
  send(message: EmailMessage, options?: SendEmailOptions): Promise<SendEmailResult>;

  /**
   * Check if the service is ready to send emails.
   * @returns {Promise<boolean>} True if service is ready
   */
  isReady(): Promise<boolean>;

  /**
   * Validate an email address format.
   * @param email - Email address to validate
   * @returns {Promise<boolean>} True if email is valid
   */
  validateEmail(email: string): Promise<boolean>;

  /**
   * Get service status information.
   * @returns {Promise<Record<string, any>>} Service status data
   */
  getStatus(): Promise<Record<string, any>>;

  /**
   * Close the service connection and clean up resources.
   * @returns {Promise<void>}
   */
  close(): Promise<void>;
}

/**
 * Factory function to create an email service instance.
 */
export type EmailServiceFactory = (config: EmailServiceConfig) => Promise<EmailService>;