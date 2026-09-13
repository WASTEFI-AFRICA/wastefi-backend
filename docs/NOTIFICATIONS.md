# Notification System Guide

This document provides comprehensive guidance on using the WasteFi notification system for SMS and email communications.

## Table of Contents

- [Overview](#overview)
- [Supported Channels](#supported-channels)
- [Setup Instructions](#setup-instructions)
- [Notification Types](#notification-types)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The WasteFi notification system provides unified SMS and email notifications through a single service interface. It supports:

- **SMS notifications** via Twilio
- **Email notifications** via SMTP (supports Gmail, SendGrid, AWS SES, etc.)
- **Multi-channel notifications** (send to both SMS and email simultaneously)
- **Template-based messages** for common notification types
- **Graceful degradation** (continues if one channel fails)

---

## Supported Channels

### SMS (via Twilio)

**Features:**
- Global SMS delivery
- Delivery status tracking
- Phone number validation
- Privacy-focused (masked phone numbers in logs)

**Coverage:** Worldwide (200+ countries)

### Email (via SMTP)

**Features:**
- HTML and plain text emails
- Multiple recipients (to, cc, bcc)
- Email validation
- Privacy-focused (masked emails in logs)

**Providers:** Gmail, SendGrid, AWS SES, Mailgun, or any SMTP server

---

## Setup Instructions

### 1. SMS Setup (Twilio)

#### Get Twilio Credentials

1. Visit [Twilio Console](https://console.twilio.com/)
2. Sign up or log in
3. Get your **Account SID** and **Auth Token**
4. Purchase a phone number or use a trial number

#### Configure Environment Variables

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

#### Trial vs Production

- **Trial Account**: 
  - Free credit for testing
  - Can only send to verified numbers
  - Messages include "Sent from a Twilio trial account"
  
- **Production Account**:
  - Upgrade with payment method
  - Send to any number
  - No trial message prefix

### 2. Email Setup (SMTP)

#### Option A: Gmail

**Requirements:**
- Gmail account
- App Password (not your regular password)

**Steps to get App Password:**
1. Enable 2-Step Verification on your Google account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. Use the generated 16-character password

**Configuration:**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
EMAIL_FROM=WasteFi <noreply@wastefi.com>
```

#### Option B: SendGrid

**Configuration:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=WasteFi <noreply@wastefi.com>
```

#### Option C: AWS SES

**Configuration:**
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
EMAIL_FROM=WasteFi <noreply@wastefi.com>
```

#### Option D: Custom SMTP Server

```env
EMAIL_HOST=mail.yourdomain.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASSWORD=your-password
EMAIL_FROM=WasteFi <noreply@yourdomain.com>
```

---

## Notification Types

The system provides pre-built notification templates for common scenarios:

### 1. Welcome Notification
Sent when a new user registers.

**Channels:** SMS + Email  
**Content:** Welcome message with getting started guide

### 2. Verification Code
Sent for email/phone verification.

**Channels:** SMS + Email  
**Content:** Verification code (expires in 10 minutes)

### 3. Payment Notification
Sent when user receives payment.

**Channels:** SMS + Email  
**Content:** Payment amount, currency, transaction ID

### 4. Collection Verified
Sent when waste collection is verified.

**Channels:** SMS + Email  
**Content:** Collection details, earnings, material type, weight

### 5. KYC Approved
Sent when KYC verification is approved.

**Channels:** SMS + Email  
**Content:** Approval confirmation, available features

### 6. KYC Rejected
Sent when KYC verification is rejected.

**Channels:** SMS + Email  
**Content:** Rejection reason, instructions to resubmit

### 7. Withdrawal Confirmation
Sent when withdrawal is initiated.

**Channels:** SMS + Email  
**Content:** Withdrawal amount, destination phone number, transaction ID

### 8. Password Reset
Sent when user requests password reset.

**Channels:** Email only  
**Content:** Reset token, reset link (expires in 1 hour)

---

## Usage Examples

### Basic Usage

```typescript
import { NotificationService } from './services/notification.service';

// Send welcome notification (both SMS and email)
await NotificationService.sendWelcome(
  '+254712345678',
  'user@example.com',
  'John'
);

// Send only SMS
await NotificationService.sendWelcome(
  '+254712345678',
  'user@example.com',
  'John',
  { sms: true, email: false }
);

// Send only email
await NotificationService.sendWelcome(
  '+254712345678',
  'user@example.com',
  'John',
  { sms: false, email: true }
);
```

### Payment Notification

```typescript
await NotificationService.sendPaymentNotification(
  '+254712345678',
  'user@example.com',
  'John',
  500,
  'KES',
  'transaction-uuid',
  { sms: true, email: true }
);
```

### Collection Verified

```typescript
await NotificationService.sendCollectionVerified(
  '+254712345678',
  'user@example.com',
  'John',
  'collection-uuid',
  750,
  'KES',
  'Plastic',
  25.5
);
```

### KYC Notifications

```typescript
// KYC Approved
await NotificationService.sendKYCApproved(
  '+254712345678',
  'user@example.com',
  'John'
);

// KYC Rejected
await NotificationService.sendKYCRejected(
  '+254712345678',
  'user@example.com',
  'John',
  'ID document is not clear, please upload a better photo'
);
```

### Password Reset

```typescript
await NotificationService.sendPasswordReset(
  'user@example.com',
  'John',
  '123456',
  'https://app.wastefi.com/reset-password?token=abc123'
);
```

### Handling Results

```typescript
const result = await NotificationService.sendWelcome(
  '+254712345678',
  'user@example.com',
  'John'
);

// Check SMS status
if (result.sms) {
  if (result.sms.success) {
    console.log('SMS sent successfully');
  } else {
    console.error('SMS failed:', result.sms.error);
  }
}

// Check email status
if (result.email) {
  if (result.email.success) {
    console.log('Email sent successfully');
  } else {
    console.error('Email failed:', result.email.error);
  }
}
```

### Check Available Channels

```typescript
const channels = NotificationService.getAvailableChannels();

if (channels.sms) {
  console.log('SMS notifications available');
}

if (channels.email) {
  console.log('Email notifications available');
}
```

---

## Best Practices

### 1. Always Handle Failures Gracefully

Notifications can fail due to network issues, invalid credentials, or service outages. Always handle failures:

```typescript
const result = await NotificationService.sendPaymentNotification(...);

if (result.sms && !result.sms.success) {
  logger.warn('SMS notification failed', { error: result.sms.error });
  // Continue with the main flow - notification is not critical
}
```

### 2. Don't Block Critical Operations

Never let notification failures block critical operations:

```typescript
// ❌ Bad
try {
  await processPayment();
  await NotificationService.sendPaymentNotification(...);
} catch (error) {
  // Payment might be rolled back if notification fails
}

// ✅ Good
try {
  await processPayment();
} catch (error) {
  // Handle payment failure
}

// Send notification separately (don't await if not critical)
NotificationService.sendPaymentNotification(...).catch(error => {
  logger.error('Notification failed', { error });
});
```

### 3. Use Appropriate Channels

- **SMS**: Time-sensitive, critical notifications (verification codes, payment alerts)
- **Email**: Detailed information, receipts, reports, password resets
- **Both**: Welcome messages, KYC updates, collection notifications

### 4. Respect User Preferences

In production, respect user notification preferences:

```typescript
const user = await getUserById(userId);

const options = {
  sms: user.notificationPreferences.sms,
  email: user.notificationPreferences.email,
};

await NotificationService.sendPaymentNotification(..., options);
```

### 5. Rate Limiting

Be mindful of notification volumes:
- SMS costs money per message
- Email providers have rate limits
- Consider batching notifications

### 6. Privacy and Security

- Never log full phone numbers or emails
- Use masked versions in logs (provided by the services)
- Don't include sensitive data in notifications
- Use secure channels (HTTPS, TLS)

### 7. Testing

Test notifications thoroughly before production:
- Use sandbox/test credentials
- Test with verified numbers/emails in trial mode
- Verify message content and formatting
- Test failure scenarios

---

## Testing

### Testing SMS (Twilio)

#### Trial Mode
With a Twilio trial account:
1. Verify your phone number in Twilio Console
2. Use verified numbers for testing
3. SMS will include trial message prefix

```typescript
// Test SMS
const result = await SMSService.sendSMS({
  to: '+254712345678', // Your verified number
  message: 'Test message from WasteFi'
});

console.log('SMS sent:', result.success);
```

#### Production Mode
After upgrading:
1. Can send to any number
2. No trial prefix
3. Costs apply per message

### Testing Email

#### Gmail
1. Use your Gmail account with app password
2. Send test emails to yourself
3. Check spam folder if not received

```typescript
// Test email
const result = await EmailService.sendEmail({
  to: 'your-email@gmail.com',
  subject: 'Test Email',
  text: 'This is a test email from WasteFi',
  html: '<p>This is a test email from WasteFi</p>'
});

console.log('Email sent:', result.success);
```

#### SendGrid/AWS SES
1. Verify sender email address
2. In sandbox mode, can only send to verified recipients
3. Request production access for unrestricted sending

### Testing Notification Templates

Create a test script:

```typescript
// test-notifications.ts
import { NotificationService } from './src/services/notification.service';

async function testNotifications() {
  NotificationService.initialize();

  const testPhone = '+254712345678';
  const testEmail = 'your-email@example.com';
  const testName = 'Test User';

  console.log('Testing welcome notification...');
  const result = await NotificationService.sendWelcome(
    testPhone,
    testEmail,
    testName
  );
  console.log('Result:', result);

  // Test other notifications...
}

testNotifications();
```

Run with:
```bash
ts-node test-notifications.ts
```

---

## Troubleshooting

### SMS Issues

#### "SMS service not configured"
**Cause:** Missing Twilio credentials  
**Solution:** Ensure all Twilio environment variables are set

#### "Invalid phone number format"
**Cause:** Phone number not in E.164 format  
**Solution:** Use format `+[country_code][number]` (e.g., `+254712345678`)

#### "Authentication Error"
**Cause:** Invalid Account SID or Auth Token  
**Solution:** Verify credentials in Twilio Console

#### "To number not verified"
**Cause:** Using trial account with unverified number  
**Solution:** Verify the number in Twilio Console or upgrade account

### Email Issues

#### "Email service not configured"
**Cause:** Missing SMTP credentials  
**Solution:** Ensure all email environment variables are set

#### "Authentication failed"
**Cause:** Invalid username/password  
**Solution:** 
- Gmail: Use app password, not regular password
- SendGrid: Use "apikey" as username
- Verify credentials are correct

#### "Connection timeout"
**Cause:** Network/firewall issues  
**Solution:** 
- Check EMAIL_HOST is correct
- Ensure port 587 is not blocked
- Try port 465 with EMAIL_SECURE=true

#### "Email not received"
**Cause:** Spam filter, wrong address, or rate limiting  
**Solution:**
- Check spam/junk folder
- Verify email address is correct
- Check provider's sending limits
- Review sender reputation

### General Issues

#### Notifications not being sent
1. Check if services are initialized
2. Verify environment variables
3. Check logs for error messages
4. Test services individually (SMS then email)

#### Partial failures
Both channels can fail independently:
```typescript
const result = await NotificationService.sendWelcome(...);

if (result.sms?.success && !result.email?.success) {
  console.log('SMS sent, but email failed');
  // Only email needs to be retried
}
```

---

## Production Checklist

Before going live:

- [ ] Obtain production Twilio account (if using SMS)
- [ ] Verify sender email domain (for better deliverability)
- [ ] Set up proper EMAIL_FROM address
- [ ] Test all notification templates
- [ ] Implement user notification preferences
- [ ] Set up notification monitoring/alerting
- [ ] Review and optimize notification costs
- [ ] Ensure compliance with spam regulations
- [ ] Test failure scenarios
- [ ] Document internal procedures

---

## Cost Considerations

### SMS Costs (Twilio)

- **Kenya**: ~$0.05 per SMS
- **Uganda**: ~$0.06 per SMS
- **Tanzania**: ~$0.06 per SMS

**Optimization tips:**
- Only send SMS for critical notifications
- Prefer email for detailed information
- Implement user preferences
- Consider SMS bundles for volume discounts

### Email Costs

- **Gmail**: Free (with daily limits)
- **SendGrid**: Free tier (100 emails/day), paid plans from $19.95/month
- **AWS SES**: $0.10 per 1,000 emails (very affordable for high volume)

---

## Support Resources

### Twilio
- [Documentation](https://www.twilio.com/docs)
- [Console](https://console.twilio.com/)
- Support: support@twilio.com

### Email Providers
- **Gmail**: [Support](https://support.google.com/mail)
- **SendGrid**: [Documentation](https://docs.sendgrid.com/)
- **AWS SES**: [Documentation](https://docs.aws.amazon.com/ses/)

---

**Last Updated:** 2026-09-13  
**Version:** 1.0.0
