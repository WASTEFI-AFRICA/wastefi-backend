# Notification Integration Guide

Quick reference for integrating notifications into WasteFi controllers and services.

## Table of Contents

- [Import Statement](#import-statement)
- [User Registration](#user-registration)
- [KYC Verification](#kyc-verification)
- [Waste Collection](#waste-collection)
- [Payment Processing](#payment-processing)
- [Withdrawal](#withdrawal)
- [Password Reset](#password-reset)

---

## Import Statement

Add this to any controller or service that needs notifications:

```typescript
import { NotificationService } from '../services/notification.service';
```

---

## User Registration

**Location:** `src/controllers/auth.controller.ts` or `src/services/auth.service.ts`

**When:** After successful user registration

```typescript
// After creating user in database
const user = await prisma.user.create({
  data: { ... }
});

// Send welcome notification (non-blocking)
NotificationService.sendWelcome(
  user.phoneNumber,
  user.email || '',
  user.firstName
).catch(error => {
  logger.error('Welcome notification failed', { error, userId: user.id });
});
```

---

## KYC Verification

**Location:** `src/controllers/user.controller.ts` or `src/services/user.service.ts`

### KYC Approved

**When:** After admin approves KYC documents

```typescript
// After updating user KYC status to APPROVED
await prisma.user.update({
  where: { id: userId },
  data: { kycStatus: 'APPROVED' },
});

// Get user details
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Send approval notification
NotificationService.sendKYCApproved(user.phoneNumber, user.email || '', user.firstName).catch(
  (error) => {
    logger.error('KYC approval notification failed', { error, userId });
  }
);
```

### KYC Rejected

**When:** After admin rejects KYC documents

```typescript
// After updating user KYC status to REJECTED
await prisma.user.update({
  where: { id: userId },
  data: {
    kycStatus: 'REJECTED',
    kycRejectionReason: rejectionReason,
  },
});

// Get user details
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Send rejection notification
NotificationService.sendKYCRejected(
  user.phoneNumber,
  user.email || '',
  user.firstName,
  rejectionReason
).catch((error) => {
  logger.error('KYC rejection notification failed', { error, userId });
});
```

---

## Waste Collection

**Location:** `src/controllers/waste-collection.controller.ts` or `src/services/waste-collection.service.ts`

**When:** After admin verifies a waste collection

```typescript
// After verifying collection
const collection = await prisma.wasteCollection.update({
  where: { id: collectionId },
  data: {
    status: 'VERIFIED',
    verifiedAt: new Date(),
    verifiedBy: adminId,
  },
  include: {
    collector: true,
  },
});

// Send collection verified notification
NotificationService.sendCollectionVerified(
  collection.collector.phoneNumber,
  collection.collector.email || '',
  collection.collector.firstName,
  collection.id,
  collection.paymentAmount,
  collection.paymentCurrency,
  collection.materialType,
  collection.weight
).catch((error) => {
  logger.error('Collection verified notification failed', {
    error,
    collectionId,
  });
});
```

---

## Payment Processing

**Location:** `src/services/payment.service.ts`

**When:** After successful payment to user

```typescript
// After completing payment transaction
const transaction = await prisma.transaction.create({
  data: {
    userId,
    amount,
    currency,
    type: 'WASTE_COLLECTION',
    status: 'COMPLETED',
    completedAt: new Date(),
  },
});

// Get user details
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Send payment notification
NotificationService.sendPaymentNotification(
  user.phoneNumber,
  user.email || '',
  user.firstName,
  amount,
  currency,
  transaction.id
).catch((error) => {
  logger.error('Payment notification failed', {
    error,
    transactionId: transaction.id,
  });
});
```

---

## Withdrawal

**Location:** `src/services/payment.service.ts`

**When:** After withdrawal request is initiated

```typescript
// After creating withdrawal transaction
const transaction = await prisma.transaction.create({
  data: {
    userId,
    amount,
    currency: 'KES',
    type: 'WITHDRAWAL',
    status: 'PENDING',
    paymentMethod,
    phoneNumber: withdrawalPhoneNumber,
  },
});

// Get user details
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Send withdrawal confirmation
NotificationService.sendWithdrawalConfirmation(
  user.phoneNumber,
  user.email || '',
  user.firstName,
  amount,
  'KES',
  withdrawalPhoneNumber,
  transaction.id
).catch((error) => {
  logger.error('Withdrawal notification failed', {
    error,
    transactionId: transaction.id,
  });
});
```

---

## Password Reset

**Location:** `src/controllers/auth.controller.ts` or `src/services/auth.service.ts`

**When:** User requests password reset

```typescript
// After generating reset token
const resetToken = generateResetToken();
const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

// Store token in database
await prisma.user.update({
  where: { email },
  data: {
    resetToken,
    resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour
  },
});

// Get user details
const user = await prisma.user.findUnique({
  where: { email },
});

// Send password reset email
NotificationService.sendPasswordReset(user.email, user.firstName, resetToken, resetUrl).catch(
  (error) => {
    logger.error('Password reset notification failed', { error, userId: user.id });
  }
);
```

---

## Best Practices

### 1. Non-Blocking Notifications

Always use `.catch()` to prevent notification failures from blocking the main flow:

```typescript
// ✅ Good - Non-blocking
NotificationService.sendWelcome(...).catch(error => {
  logger.error('Notification failed', { error });
});

// ❌ Bad - Blocks if notification fails
await NotificationService.sendWelcome(...);
```

### 2. Error Logging

Always log notification failures with context:

```typescript
NotificationService.sendPaymentNotification(...).catch(error => {
  logger.error('Payment notification failed', {
    error,
    userId,
    transactionId,
    amount
  });
});
```

### 3. Handle Missing Email

Some users might not have email addresses:

```typescript
NotificationService.sendWelcome(
  user.phoneNumber,
  user.email || '', // Fallback to empty string
  user.firstName
).catch((error) => {
  logger.error('Welcome notification failed', { error, userId: user.id });
});
```

### 4. Channel Selection

Choose appropriate channels based on notification type:

```typescript
// Time-sensitive: SMS only
NotificationService.sendVerificationCode(phoneNumber, email, firstName, code, {
  sms: true,
  email: false,
});

// Detailed info: Email only
NotificationService.sendCollectionVerified(
  phoneNumber,
  email,
  firstName,
  collectionId,
  amount,
  currency,
  materialType,
  weight,
  { sms: false, email: true }
);

// Important update: Both
NotificationService.sendKYCApproved(phoneNumber, email, firstName, { sms: true, email: true });
```

---

## Complete Example

Here's a complete example showing notification integration in a collection verification endpoint:

```typescript
import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { WasteCollectionService } from '../services/waste-collection.service';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger.util';

export class WasteCollectionController {
  static async verifyCollection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Verify collection
      const collection = await WasteCollectionService.verifyCollection(id, req.user!.userId);

      // Send notification (non-blocking)
      NotificationService.sendCollectionVerified(
        collection.collector.phoneNumber,
        collection.collector.email || '',
        collection.collector.firstName,
        collection.id,
        collection.paymentAmount,
        collection.paymentCurrency,
        collection.materialType,
        collection.weight
      ).catch((error) => {
        logger.error('Collection verified notification failed', {
          error,
          collectionId: id,
          userId: collection.collectorId,
        });
      });

      res.status(200).json({
        success: true,
        data: collection,
        message: 'Collection verified successfully',
      });
    } catch (error) {
      logger.error('Collection verification failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to verify collection',
      });
    }
  }
}
```

---

## Testing Notifications

### Test with Real Services

```typescript
// Initialize services
NotificationService.initialize();

// Check availability
const channels = NotificationService.getAvailableChannels();
console.log('SMS available:', channels.sms);
console.log('Email available:', channels.email);

// Test notification
const result = await NotificationService.sendWelcome(
  '+254712345678',
  'test@example.com',
  'Test User'
);

console.log('SMS result:', result.sms);
console.log('Email result:', result.email);
```

### Test Without Services

For testing without configured services, mock the NotificationService:

```typescript
// In test file
jest.mock('../services/notification.service', () => ({
  NotificationService: {
    sendWelcome: jest.fn().mockResolvedValue({
      sms: { success: true },
      email: { success: true },
    }),
  },
}));
```

---

**Last Updated:** 2026-09-13  
**Version:** 1.0.0
