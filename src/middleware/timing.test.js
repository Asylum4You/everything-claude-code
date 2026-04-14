/**
 * Tests for request timing middleware
 */
const { timingMiddleware } = require('./timing');

describe('timingMiddleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;
  let logger;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Node.js'),
      route: { path: '/api/test' },
      query: { page: '1' },
      body: { test: 'data' },
      headers: new Map([['content-type', 'application/json']])
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
      on: jest.fn()
    };

    nextFunction = jest.fn();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  it('logs request duration and basic info', () => {
    const middleware = timingMiddleware({ logger });
    middleware(mockRequest, mockResponse, nextFunction);
    expect(nextFunction).toHaveBeenCalled();

    // Simulate response finish
    (mockResponse.on as jest.Mock).mockCalls([['finish', expect.any(Function)]])[0][1]();
    
    expect(logger.info).toHaveBeenCalled();
    const logEntry = (logger.info as jest.Mock).mock.calls[0][0];
    expect(logEntry).toContain('"method":"GET"');
    expect(logEntry).toContain('"status":200');
    expect(logEntry).toContain('"url":"/api/test"');
  });

  it('captures status code from res.status', () => {
    const middleware = timingMiddleware({ logger });
    middleware(mockRequest, mockResponse, nextFunction);
    
    // Simulate setting status and finishing
    (mockResponse.status as jest.Mock).mockReturnValue(mockResponse);
    (mockResponse.status as jest.Mock).mockCalls([['finish', expect.any(Function)]])[0][1]();
    (mockResponse.status as jest.Mock).mockReturnValueOnce(404);
    
    expect(logger.warn).toHaveBeenCalled();
    const logEntry = (logger.warn as jest.Mock).mock.calls[0][0];
    expect(logEntry).toContain('"status":404');
  });

  it('logs response body when provided', () => {
    const middleware = timingMiddleware({ logger, detailed: true });
    const body = { message: 'Hello World' };
    (mockResponse.json as jest.Mock).mockReturnValue(mockResponse);
    (mockResponse.json as jest.Mock).mockCalls([['finish', expect.any(Function)]])[0][1]();
    
    expect(logger.info).toHaveBeenCalled();
    const logEntry = (logger.info as jest.Mock).mock.calls[0][0];
    expect(logEntry).toContain('"responseBody"');
  });

  it('handles errors during request', () => {
    const middleware = timingMiddleware({ logger });
    middleware(mockRequest, mockResponse, nextFunction);
    
    // Simulate an error event
    (mockResponse.on as jest.Mock).mockCalls([['error', expect.any(Function)]])[0][1](new Error('Something went wrong'));
    
    expect(logger.error).toHaveBeenCalled();
    const logEntry = (logger.error as jest.Mock).mock.calls[0][0];
    expect(logEntry).toContain('"error":"Something went wrong"');
  });

  it('includes detailed information when detailed option is true', () => {
    const middleware = timingMiddleware({ logger, detailed: true });
    middleware(mockRequest, mockResponse, nextFunction);
    (mockResponse.on as jest.Mock).mockCalls([['finish', expect.any(Function)]])[0][1]();
    
    expect(logger.info).toHaveBeenCalled();
    const logEntry = (logger.info as jest.Mock).mock.calls[0][0];
    expect(logEntry).toContain('"headers"');
    expect(logEntry).toContain('"query"');
    expect(logEntry).toContain('"body"');
  });

  it('uses correct log level based on status code', () => {
    const middleware = timingMiddleware({ logger });
    
    // Test 500 error
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    (mockResponse.status as jest.Mock).mockReturnValueOnce(500);
    middleware(mockRequest, mockResponse, nextFunction);
    (mockResponse.on as jest.Mock).mockCalls([['finish', expect.any(Function)]])[0][1]();
    
    expect(logger.error).toHaveBeenCalled();

    // Test 400 error
    const middleware2 = timingMiddleware({ logger });
    const res2 = { ...mockResponse, status: jest.fn().mockReturnValueOnce(404) };
    middleware2(mockRequest, res2 as any, nextFunction);
    (res2.on as jest.Mock).mockCalls([['finish', expect.any(Function)]])[0][1]();
    
    expect(logger.warn).toHaveBeenCalled();
  });
});