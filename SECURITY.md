# Security Policy

## Supported Versions

Currently supported versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Features

WasteFi Backend implements multiple layers of security to protect user data and prevent unauthorized access.

### Authentication & Authorization

#### JWT Token-Based Authentication

- **Access tokens**: Short-lived (15 minutes) for API requests
- **Refresh tokens**: Long-lived (7 days) for obtaining new access tokens
- **Token rotation**: Refresh tokens are rotated on each use
- **Secure storage**: Tokens should be stored in httpOnly cookies or secure storage

#### API Key Authentication

- Service-to-service authentication
- Scoped permissions per API key
- Key rotation supported
- Automatic expiration options

#### Role-Based Access Control (RBAC)

- **Roles**: `user`, `admin`
- **Permissions**: Endpoint-level access control
- **Middleware**: `requireAuth`, `requireRole` for protection

### Data Protection

#### Encryption

- **At Rest**: Database encryption with PostgreSQL native encryption
- **In Transit**: TLS 1.2+ for all API communications
- **Password Hashing**: bcrypt with salt rounds (10)
- **Sensitive Data**: AES-256-GCM encryption for PII

#### Input Validation & Sanitization

- **Express Validator**: All inputs validated before processing
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Prevention**: Helmet middleware with Content Security Policy
- **Request Size Limits**: 10MB max payload size

### Rate Limiting & DDoS Protection

#### Tiered Rate Limiting

- **Free tier**: 100 requests/minute
- **Premium tier**: 1000 requests/minute
- **Per-IP limits**: Prevents single-source abuse
- **Endpoint-specific limits**:
  - Authentication: 10 req/min
  - Payments: 20 req/min
  - Write operations: 50 req/min
  - Read operations: 200 req/min

#### Redis-Backed Distributed Limiting

- Consistent rate limiting across instances
- Automatic cleanup of expired entries
- Graceful fallback if Redis unavailable

### Network Security

#### CORS Configuration

```javascript
{
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200
}
```

#### Security Headers (Helmet)

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000
- Content-Security-Policy: Configured

#### IP Whitelisting

- Admin endpoints restricted by IP
- Configurable whitelist in environment

### Audit Logging

#### Request Logging

- **Unique Request IDs**: Every request tracked
- **User Actions**: All authenticated actions logged
- **Failed Attempts**: Login failures, invalid tokens
- **Security Events**: Permission denials, rate limit hits

#### Log Format

```json
{
  "timestamp": "2026-09-14T12:00:00.000Z",
  "requestId": "uuid-v4",
  "level": "info|warn|error",
  "userId": "user-id",
  "action": "action-name",
  "ip": "client-ip",
  "userAgent": "client-user-agent",
  "result": "success|failure",
  "details": {}
}
```

---

## Reporting a Vulnerability

### How to Report

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

#### Preferred Contact Method

- **Email**: security@wastefi.africa
- **Subject**: [SECURITY] Brief description of issue
- **PGP Key**: Available at https://wastefi.africa/.well-known/pgp-key.txt

#### What to Include

1. **Description**: Clear description of the vulnerability
2. **Impact**: What can an attacker do?
3. **Affected Version**: Which version(s) are vulnerable?
4. **Steps to Reproduce**: Detailed reproduction steps
5. **Proof of Concept**: Code or screenshots (if applicable)
6. **Suggested Fix**: If you have one

#### Example Report

```
Subject: [SECURITY] SQL Injection in user search endpoint

Description:
The /api/v1/users/search endpoint is vulnerable to SQL injection
through the 'query' parameter.

Impact:
An attacker could extract sensitive user data or modify database records.

Affected Version:
Version 1.0.0

Steps to Reproduce:
1. Send POST request to /api/v1/users/search
2. Set query parameter to: ' OR '1'='1' --
3. Response contains all user records

Proof of Concept:
curl -X POST https://api.wastefi.africa/api/v1/users/search \
  -H "Content-Type: application/json" \
  -d '{"query": "'\'' OR '\''1'\''='\''1'\'' --"}'

Suggested Fix:
Use parameterized queries via Prisma ORM instead of raw SQL.
```

### Response Timeline

| Stage                  | Timeline             | Description                       |
| ---------------------- | -------------------- | --------------------------------- |
| **Acknowledgment**     | Within 24 hours      | We confirm receipt of your report |
| **Initial Assessment** | Within 72 hours      | We assess severity and impact     |
| **Progress Update**    | Weekly               | Regular updates on investigation  |
| **Fix Development**    | Varies by severity   | We develop and test a fix         |
| **Disclosure**         | After fix deployment | Public disclosure (if applicable) |

### Severity Levels

#### Critical (P0)

- **Response**: Immediate (15 minutes)
- **Fix**: Within 24 hours
- **Examples**:
  - Remote code execution
  - Authentication bypass
  - Data breach
  - Payment system compromise

#### High (P1)

- **Response**: 1 hour
- **Fix**: Within 7 days
- **Examples**:
  - Privilege escalation
  - SQL injection
  - XSS vulnerability
  - Sensitive data exposure

#### Medium (P2)

- **Response**: 4 hours
- **Fix**: Within 30 days
- **Examples**:
  - CSRF vulnerability
  - Information disclosure
  - Weak encryption
  - Rate limit bypass

#### Low (P3)

- **Response**: 24 hours
- **Fix**: Next release
- **Examples**:
  - Missing security headers
  - Verbose error messages
  - Outdated dependencies
  - Documentation issues

### Reward Program

We appreciate responsible disclosure and may offer rewards for valid vulnerabilities:

- **Critical**: Up to $1,000
- **High**: Up to $500
- **Medium**: Up to $250
- **Low**: Recognition in CONTRIBUTORS.md

Rewards are at our discretion and depend on:

- Severity and impact
- Quality of report
- Originality (first to report)
- Responsible disclosure

---

## Security Best Practices

### For Developers

#### Secure Coding

```javascript
// ✅ Good: Use Prisma ORM
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// ❌ Bad: Raw SQL with string concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ Good: Hash passwords
const hashedPassword = await bcrypt.hash(password, 10);

// ❌ Bad: Store plain text passwords
const password = req.body.password;

// ✅ Good: Validate inputs
const { error, value } = schema.validate(req.body);
if (error) throw new ValidationError(error);

// ❌ Bad: Trust user input
const userId = req.body.userId;
deleteUser(userId);
```

#### Secret Management

```bash
# ✅ Good: Use environment variables
JWT_SECRET=randomly-generated-32-char-secret

# ❌ Bad: Hardcode secrets
const JWT_SECRET = "mysecret123";

# ✅ Good: Generate strong secrets
openssl rand -base64 32

# ❌ Bad: Use weak secrets
const JWT_SECRET = "password";
```

#### Dependency Management

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Remove unused dependencies
npm prune
```

### For Operators

#### Environment Security

```bash
# Restrict .env file permissions
chmod 600 .env
chown app:app .env

# Never commit .env to git
echo ".env" >> .gitignore

# Use secret management systems
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
```

#### Database Security

```sql
-- Use strong passwords
ALTER USER wastefi_user WITH PASSWORD 'strong-random-password-32-chars';

-- Limit connections
ALTER SYSTEM SET max_connections = 100;

-- Enable SSL
ALTER SYSTEM SET ssl = on;

-- Restrict network access
-- Edit pg_hba.conf
hostssl all all 0.0.0.0/0 scram-sha-256

-- Regular backups
-- See PRODUCTION_READINESS.md
```

#### Network Security

```bash
# Configure firewall
ufw enable
ufw default deny incoming
ufw allow 22/tcp   # SSH
ufw allow 443/tcp  # HTTPS

# Install fail2ban
apt-get install fail2ban

# Use SSH keys, disable password auth
# Edit /etc/ssh/sshd_config
PasswordAuthentication no
PubkeyAuthentication yes
```

### For Users

#### API Key Security

- **Never share** API keys
- **Rotate regularly** (every 90 days)
- **Use different keys** for different environments
- **Revoke immediately** if compromised
- **Monitor usage** for anomalies

#### Password Best Practices

- **Minimum 12 characters**
- **Use password manager**
- **Enable 2FA** (when available)
- **Unique password** per service
- **Change if compromised**

#### Safe API Usage

```javascript
// ✅ Good: Store tokens securely
localStorage.setItem('accessToken', token); // For web apps
// Or use httpOnly cookies

// ❌ Bad: Expose tokens in URLs
fetch(`/api/users?token=${accessToken}`);

// ✅ Good: Use HTTPS
const response = await fetch('https://api.wastefi.africa/...');

// ❌ Bad: Use HTTP
const response = await fetch('http://api.wastefi.africa/...');
```

---

## Vulnerability Disclosure Policy

### Responsible Disclosure

We follow coordinated vulnerability disclosure:

1. **Private Reporting**: Report to security@wastefi.africa first
2. **No Public Disclosure**: Until fix is deployed (typically 90 days)
3. **Coordinated Announcement**: We work with you on disclosure timing
4. **Credit**: We acknowledge reporters (unless they prefer anonymity)

### Out of Scope

The following are **not** considered security vulnerabilities:

- **Denial of Service**: Requires significant resources
- **SPF/DMARC/DKIM**: Email configuration issues
- **SSL/TLS**: Issues with older protocols (we support TLS 1.2+)
- **Self-XSS**: Requires victim to execute malicious code themselves
- **Social Engineering**: Phishing, etc.
- **Physical Security**: Physical access to servers
- **Rate Limiting**: Standard rate limiting is not a vulnerability
- **User Enumeration**: Via standard functionality
- **Missing Security Headers**: If not exploitable
- **Theoretical Vulnerabilities**: Without proof of concept

### Public Disclosure

After a fix is deployed, we may publicly disclose:

- **CVE ID**: If severity warrants
- **Advisory**: Detailed vulnerability description
- **Fix**: Version number with fix
- **Credit**: To the reporter (if they agree)
- **Timeline**: Discovery to fix timeline

---

## Security Updates

### Update Notification

Subscribe to security updates:

- **Email**: security-announce@wastefi.africa
- **GitHub**: Watch repository for security advisories
- **RSS**: https://wastefi.africa/security/feed.xml

### Critical Updates

For critical vulnerabilities:

- **Immediate Notification**: Via email and GitHub
- **Emergency Patch**: Released ASAP
- **Upgrade Required**: All users must upgrade

---

## Compliance

### Standards & Frameworks

We follow security best practices from:

- **OWASP Top 10**: Web application security risks
- **CWE Top 25**: Most dangerous software weaknesses
- **NIST Cybersecurity Framework**: Security program structure
- **ISO 27001**: Information security management (pursuing)

### Regular Security Activities

- **Weekly**: Dependency vulnerability scanning
- **Monthly**: Security patch updates
- **Quarterly**: Code security review
- **Annually**: Third-party penetration testing

---

## Security Contacts

### General Security

- **Email**: security@wastefi.africa
- **Response Time**: Within 24 hours

### Security Emergencies

- **Email**: security-urgent@wastefi.africa
- **Phone**: +254-XXX-XXXXXX (24/7)
- **Response Time**: Within 1 hour

### Bug Bounty

- **Email**: bounty@wastefi.africa
- **Platform**: https://wastefi.africa/security/bounty

---

## Security Changelog

### Version 1.0.0 (2026-09-14)

- Initial security implementation
- JWT authentication system
- Rate limiting (Redis-backed)
- Input validation middleware
- Audit logging
- API versioning
- Database backup system

### Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] OAuth 2.0 integration
- [ ] Biometric authentication
- [ ] Advanced threat detection
- [ ] Security information and event management (SIEM)
- [ ] Web Application Firewall (WAF)

---

## License

This security policy is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

**Last Updated**: September 14, 2026  
**Next Review**: December 14, 2026  
**Version**: 1.0.0
