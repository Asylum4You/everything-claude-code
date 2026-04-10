/**
 * Integration tests for authentication flows
 *
 * Run with: node tests/integration/auth.test.js
 *
 * This test suite covers comprehensive authentication functionality:
 * - User registration flow (success and failure cases)
 * - User login flow (success, wrong password, unverified email, etc.)
 * - Password reset flow (request, reset with valid/invalid token)
 * - Profile update functionality
 * - Protected routes with authenticated/unauthenticated users
 * - Email sending functionality
 * - Rate limiting and security features
 */

const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

// Mock authentication server for testing
// In a real implementation, this would be replaced with actual server startup
class MockAuthServer {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.resetTokens = new Map();
    this.rateLimits = new Map();
    this.emails = [];
  }

  // Mock user registration
  register(email, password, name) {
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }

    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }

    if (password.length < 8) {
      throw new Error('Password too short');
    }

    const user = {
      id: Date.now().toString(),
      email,
      name,
      password, // In real implementation, this would be hashed
      verified: false,
      createdAt: new Date()
    };

    this.users.set(email, user);
    return user;
  }

  // Mock user login
  login(email, password) {
    const user = this.users.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.password !== password) {
      throw new Error('Invalid password');
    }

    if (!user.verified) {
      throw new Error('Email not verified');
    }

    const sessionId = `session_${Date.now()}`;
    this.sessions.set(sessionId, { userId: user.id, email, createdAt: new Date() });

    return { sessionId, user: { id: user.id, email: user.email, name: user.name } };
  }

  // Mock password reset request
  requestPasswordReset(email) {
    const user = this.users.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    const token = `reset_${Date.now()}_${Math.random()}`;
    this.resetTokens.set(token, { email, expiresAt: new Date(Date.now() + 3600000) }); // 1 hour

    // Mock email sending
    this.emails.push({
      to: email,
      subject: 'Password Reset',
      body: `Reset token: ${token}`
    });

    return { success: true };
  }

  // Mock password reset
  resetPassword(token, newPassword) {
    const resetData = this.resetTokens.get(token);
    if (!resetData) {
      throw new Error('Invalid reset token');
    }

    if (new Date() > resetData.expiresAt) {
      throw new Error('Reset token expired');
    }

    const user = this.users.get(resetData.email);
    if (!user) {
      throw new Error('User not found');
    }

    user.password = newPassword;
    this.resetTokens.delete(token);

    return { success: true };
  }

  // Mock profile update
  updateProfile(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    const user = Array.from(this.users.values()).find(u => u.id === session.userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (updates.name) user.name = updates.name;
    if (updates.email) {
      if (this.users.has(updates.email) && updates.email !== user.email) {
        throw new Error('Email already taken');
      }
      this.users.delete(user.email);
      user.email = updates.email;
      this.users.set(user.email, user);
    }

    return { id: user.id, email: user.email, name: user.name };
  }

  // Mock protected route access
  accessProtected(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Unauthorized');
    }

    return { message: 'Protected content accessed', userId: session.userId };
  }

  // Mock rate limiting
  checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    const key = identifier;
    const now = Date.now();

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }

    const requests = this.rateLimits.get(key);
    const windowStart = now - windowMs;

    // Remove old requests
    const validRequests = requests.filter(time => time > windowStart);

    if (validRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }

    validRequests.push(now);
    this.rateLimits.set(key, validRequests);
    return true;
  }

  // Mock email verification
  verifyEmail(email) {
    const user = this.users.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    user.verified = true;
    return { success: true };
  }
}

// Test helper
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    if (err.stack) {
      console.log(`    Stack: ${err.stack.split('\n')[1]?.trim()}`);
    }
    return false;
  }
}

// Test suite
function runAuthIntegrationTests() {
  console.log('\n=== Authentication Integration Tests ===\n');

  let passed = 0;
  let failed = 0;
  const server = new MockAuthServer();

  // User Registration Flow Tests
  console.log('User Registration Flow:');

  if (test('successful user registration', () => {
    const user = server.register('john@example.com', 'password123', 'John Doe');
    assert.strictEqual(user.email, 'john@example.com');
    assert.strictEqual(user.name, 'John Doe');
    assert.strictEqual(user.verified, false);
  })) passed++; else failed++;

  if (test('registration with duplicate email fails', () => {
    assert.throws(() => {
      server.register('john@example.com', 'password456', 'Jane Doe');
    }, /User already exists/);
  })) passed++; else failed++;

  if (test('registration with invalid email fails', () => {
    assert.throws(() => {
      server.register('invalid-email', 'password123', 'John Doe');
    }, /Invalid email format/);
  })) passed++; else failed++;

  if (test('registration with short password fails', () => {
    assert.throws(() => {
      server.register('jane@example.com', 'short', 'Jane Doe');
    }, /Password too short/);
  })) passed++; else failed++;

  // Email Verification Tests
  console.log('\nEmail Verification:');

  if (test('email verification succeeds', () => {
    const result = server.verifyEmail('john@example.com');
    assert.strictEqual(result.success, true);

    const user = server.users.get('john@example.com');
    assert.strictEqual(user.verified, true);
  })) passed++; else failed++;

  // User Login Flow Tests
  console.log('\nUser Login Flow:');

  if (test('successful login after verification', () => {
    const result = server.login('john@example.com', 'password123');
    assert(result.sessionId);
    assert(result.user);
    assert.strictEqual(result.user.email, 'john@example.com');
    assert.strictEqual(result.user.name, 'John Doe');
  })) passed++; else failed++;

  if (test('login with wrong password fails', () => {
    assert.throws(() => {
      server.login('john@example.com', 'wrongpassword');
    }, /Invalid password/);
  })) passed++; else failed++;

  if (test('login with non-existent user fails', () => {
    assert.throws(() => {
      server.login('nonexistent@example.com', 'password123');
    }, /User not found/);
  })) passed++; else failed++;

  if (test('login with unverified email fails', () => {
    // Register another user but don't verify
    server.register('unverified@example.com', 'password123', 'Unverified User');
    assert.throws(() => {
      server.login('unverified@example.com', 'password123');
    }, /Email not verified/);
  })) passed++; else failed++;

  // Password Reset Flow Tests
  console.log('\nPassword Reset Flow:');

  if (test('password reset request succeeds', () => {
    const result = server.requestPasswordReset('john@example.com');
    assert.strictEqual(result.success, true);
    assert.strictEqual(server.emails.length, 1);
    assert.strictEqual(server.emails[0].to, 'john@example.com');
    assert(server.emails[0].body.includes('Reset token:'));
  })) passed++; else failed++;

  if (test('password reset request for non-existent user fails', () => {
    assert.throws(() => {
      server.requestPasswordReset('nonexistent@example.com');
    }, /User not found/);
  })) passed++; else failed++;

  if (test('password reset with valid token succeeds', () => {
    const resetToken = server.emails[0].body.match(/Reset token: (\S+)/)[1];
    const result = server.resetPassword(resetToken, 'newpassword123');
    assert.strictEqual(result.success, true);

    // Verify login with new password works
    const loginResult = server.login('john@example.com', 'newpassword123');
    assert(loginResult.sessionId);
  })) passed++; else failed++;

  if (test('password reset with invalid token fails', () => {
    assert.throws(() => {
      server.resetPassword('invalid_token', 'newpassword123');
    }, /Invalid reset token/);
  })) passed++; else failed++;

  if (test('password reset with expired token fails', () => {
    // Mock an expired token
    const expiredToken = 'expired_token';
    server.resetTokens.set(expiredToken, {
      email: 'john@example.com',
      expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
    });

    assert.throws(() => {
      server.resetPassword(expiredToken, 'newpassword123');
    }, /Reset token expired/);
  })) passed++; else failed++;

  // Profile Update Tests
  console.log('\nProfile Update Functionality:');

  if (test('successful profile update', () => {
    const loginResult = server.login('john@example.com', 'newpassword123');
    const sessionId = loginResult.sessionId;

    const updated = server.updateProfile(sessionId, { name: 'John Smith' });
    assert.strictEqual(updated.name, 'John Smith');
    assert.strictEqual(updated.email, 'john@example.com');
  })) passed++; else failed++;

  if (test('profile update with invalid session fails', () => {
    assert.throws(() => {
      server.updateProfile('invalid_session', { name: 'New Name' });
    }, /Invalid session/);
  })) passed++; else failed++;

  if (test('email update to existing email fails', () => {
    // Register another verified user
    server.register('jane@example.com', 'password123', 'Jane Doe');
    server.verifyEmail('jane@example.com');

    const loginResult = server.login('john@example.com', 'newpassword123');
    const sessionId = loginResult.sessionId;

    assert.throws(() => {
      server.updateProfile(sessionId, { email: 'jane@example.com' });
    }, /Email already taken/);
  })) passed++; else failed++;

  // Protected Routes Tests
  console.log('\nProtected Routes:');

  if (test('authenticated user can access protected route', () => {
    const loginResult = server.login('john@example.com', 'newpassword123');
    const sessionId = loginResult.sessionId;

    const result = server.accessProtected(sessionId);
    assert(result.message);
    assert.strictEqual(result.userId, loginResult.user.id);
  })) passed++; else failed++;

  if (test('unauthenticated user cannot access protected route', () => {
    assert.throws(() => {
      server.accessProtected('invalid_session');
    }, /Unauthorized/);
  })) passed++; else failed++;

  // Rate Limiting Tests
  console.log('\nRate Limiting:');

  if (test('requests within limit succeed', () => {
    const identifier = 'test_user';
    for (let i = 0; i < 5; i++) {
      const allowed = server.checkRateLimit(identifier, 10);
      assert.strictEqual(allowed, true);
    }
  })) passed++; else failed++;

  if (test('requests over limit are blocked', () => {
    const identifier = 'test_user_2';
    // Use up the limit
    for (let i = 0; i < 10; i++) {
      server.checkRateLimit(identifier, 10);
    }
    // This should be blocked
    const blocked = server.checkRateLimit(identifier, 10);
    assert.strictEqual(blocked, false);
  })) passed++; else failed++;

  // Email Sending Tests
  console.log('\nEmail Sending:');

  if (test('password reset email is sent', () => {
    // Clear previous emails
    server.emails = [];

    server.requestPasswordReset('john@example.com');
    assert.strictEqual(server.emails.length, 1);
    assert.strictEqual(server.emails[0].to, 'john@example.com');
    assert(server.emails[0].subject.includes('Password Reset'));
    assert(server.emails[0].body.includes('Reset token'));
  })) passed++; else failed++;

  // Security Tests
  console.log('\nSecurity Features:');

  if (test('password reset tokens are unique', () => {
    server.emails = [];
    server.requestPasswordReset('john@example.com');
    server.requestPasswordReset('john@example.com');

    const token1 = server.emails[0].body.match(/Reset token: (\S+)/)[1];
    const token2 = server.emails[1].body.match(/Reset token: (\S+)/)[1];

    assert.notStrictEqual(token1, token2);
  })) passed++; else failed++;

  if (test('used reset tokens cannot be reused', () => {
    server.emails = [];
    server.requestPasswordReset('john@example.com');
    const token = server.emails[0].body.match(/Reset token: (\S+)/)[1];

    // Use the token
    server.resetPassword(token, 'password456');

    // Try to use it again
    assert.throws(() => {
      server.resetPassword(token, 'password789');
    }, /Invalid reset token/);
  })) passed++; else failed++;

  // Edge Cases
  console.log('\nEdge Cases:');

  if (test('empty password reset request fails', () => {
    assert.throws(() => {
      server.requestPasswordReset('');
    }, /User not found/);
  })) passed++; else failed++;

  if (test('login with empty credentials fails', () => {
    assert.throws(() => {
      server.login('', '');
    }, /User not found/);
  })) passed++; else failed++;

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  return { passed, failed, total: passed + failed };
}

// Run the tests
if (require.main === module) {
  const results = runAuthIntegrationTests();
  console.log(`\nPassed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.total}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

module.exports = { runAuthIntegrationTests, MockAuthServer };