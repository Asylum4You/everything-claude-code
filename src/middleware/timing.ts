/**
 * Request timing and logging middleware for Node.js/Express servers.
 * Logs request duration, status codes, route patterns, and performance metrics.
 */
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@/skills/claude-orchestrator/logger';

/**
 * Middleware configuration options.
 */
export interface TimingMiddlewareOptions {
  /**
   * Log level threshold (debug, info, warn, error).
   * Default: 'info'
   */
  logLevel?: string;

  /**
   * Whether to include detailed request information (headers, body params).
   * Default: false
   */
  detailed?: boolean;

  /**
   * Custom logger instance.
   * If not provided, uses console.
   */
  logger?: Logger | Console;
}

/**
 * Express middleware that logs request timing and details.
 *
 * @param options - Middleware configuration
 * @returns Express middleware function
 */
export function timingMiddleware(options: TimingMiddlewareOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    logLevel = 'info',
    detailed = false,
    logger = console
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    // Save original end method to capture status code
    const originalEnd = res.end;
    let statusCode = 200;
    let responseBody: any = null;

    res.end = function (chunk?: any, encoding?: string): void {
      // Capture response body if possible
      if (chunk && typeof chunk === 'string') {
        try {
          responseBody = JSON.parse(chunk);
        } catch {
          responseBody = chunk;
        }
      }
      res.end = originalEnd;
      res.end(chunk, encoding);
    };

    // Override status method to capture status code
    const originalStatus = res.status;
    res.status = function (code: number): Response {
      statusCode = code;
      return originalStatus.call(res, code);
    };

    // Override json method to capture body
    const originalJson = res.json;
    res.json = function (body: any): Response {
      responseBody = body;
      return originalJson.call(res, body);
    };

    // Continue to next middleware/handler
    next();

    // Listen for response finish to calculate duration
    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds

      const logData = {
        method: req.method,
        url: req.originalUrl || req.url,
        status: statusCode,
        duration: duration.toFixed(2) + 'ms',
        route: req.route?.path || req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        ...(detailed && {
          headers: Object.fromEntries(req.headers.entries()),
          query: req.query,
          body: req.body
        }),
        ...(responseBody && { responseBody })
      };

      // Log based on status code
      if (statusCode >= 500) {
        logger.error ? logger.error(JSON.stringify(logData)) : console.error(JSON.stringify(logData));
      } else if (statusCode >= 400) {
        logger.warn ? logger.warn(JSON.stringify(logData)) : console.warn(JSON.stringify(logData));
      } else if (statusCode >= 300) {
        logger.info ? logger.info(JSON.stringify(logData)) : console.info(JSON.stringify(logData));
      } else {
        logger.debug ? logger.debug(JSON.stringify(logData)) : console.debug(JSON.stringify(logData));
      }
    });

    // Handle errors
    res.on('error', (error) => {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      const logData = {
        method: req.method,
        url: req.originalUrl || req.url,
        status: 'error',
        error: error.message,
        duration: duration.toFixed(2) + 'ms'
      };
      logger.error ? logger.error(JSON.stringify(logData)) : console.error(JSON.stringify(logData));
    });
  };
}