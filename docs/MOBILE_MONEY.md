# Mobile Money Integration Guide

This document provides comprehensive guidance on integrating and using mobile money payment services in WasteFi Backend.

## Table of Contents

- [Overview](#overview)
- [Supported Providers](#supported-providers)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [Payment Flow](#payment-flow)
- [Callback Handling](#callback-handling)
- [Testing](#testing)
- [Error Handling](#error-handling)
- [Security Considerations](#security-considerations)

---

## Overview

WasteFi integrates with three major mobile money providers across Africa:

1. **M-Pesa** (Safaricom - Kenya)
2. **MTN Mobile Money** (MTN - Multiple countries)
3. **Airtel Money** (Airtel - Multiple countries)

The integration supports:
- **Collection payments**: Users receiving payments for waste collection
- **Withdrawals**: Users cashing out their earnings to mobile money

---

## Supported Providers

### M-Pesa (Kenya)

**Features:**
- STK Push (user prompt on phone)
- B2C payments (business to customer)
- Real-time callback notifications
- Sandbox and production environments

**Coverage:** Kenya (Safaricom network)

### MTN Mobile Money

**Features:**
- Request to Pay
- Transfer/Disbursement
- Callback notifications
- Multi-country support

**Coverage:** Uganda, Ghana, Cameroon, Ivory Coast, Zambia, Benin, Congo, Guinea, Rwanda, South Africa

### Airtel Money

**Features:**
- Payment initiation
- Disbursements
- Callback notifications
- Multi-country support

**Coverage:** Kenya, Uganda, Tanzania, Rwanda, Zambia, Gabon, Niger, Chad, DRC, Madagascar, Malawi, Nigeria, Seychelles

---

## Setup Instructions

### 1. M-Pesa Setup

#### Get API Credentials

1. Visit [Safaricom Daraja Portal](https://developer.safaricom.co.ke/)
2. Create an account and app
3. Get your **Consumer Key** and **Consumer Secret**
4. For STK Push, obtain your **Business Shortcode** and **Passkey**

#### Configure Environment Variables

```env
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_ENVIRONMENT=sandbox  # or 'production'
MPESA_SHORTCODE=174379     # Test shortcode for sandbox
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=https://yourdomain.com/api/v1/payments/callbacks/mpesa
```

#### Sandbox vs Production

- **Sandbox**: Use for testing with test credentials
  - Shortcode: `174379`
  - Test phone numbers work without real money
- **Production**: Live transactions with real money
  - Requires business approval from Safaricom
  - Use your production shortcode

### 2. MTN Mobile Money Setup

#### Get API Credentials

1. Visit [MTN MoMo Developer Portal](https://momodeveloper.mtn.com/)
2. Register and create a subscription
3. Generate API User and API Key
4. Subscribe to Collections and Disbursements products

#### Configure Environment Variables

```env
MTN_API_KEY=your_api_key_here
MTN_USER_ID=your_user_id_here
MTN_API_SECRET=your_api_secret_here
MTN_ENVIRONMENT=sandbox  # or 'production'
MTN_SUBSCRIPTION_KEY=your_subscription_key_here
MTN_CALLBACK_URL=https://yourdomain.com/api/v1/payments/callbacks/mtn
```

#### Country-Specific Configuration

MTN operates in multiple countries. Ensure your subscription covers the target country.

### 3. Airtel Money Setup

#### Get API Credentials

1. Contact Airtel Business for API access
2. Get **Client ID** and **Client Secret**
3. Request sandbox/production environment access

#### Configure Environment Variables

```env
AIRTEL_CLIENT_ID=your_client_id_here
AIRTEL_CLIENT_SECRET=your_client_secret_here
AIRTEL_ENVIRONMENT=sandbox  # or 'production'
AIRTEL_CALLBACK_URL=https://yourdomain.com/api/v1/payments/callbacks/airtel
```

### 4. Server Configuration

The mobile money services are automatically initialized when the server starts. Ensure all required environment variables are set in your `.env` file.

---

## API Endpoints

### 1. Process Payment (Deposit)

**Endpoint:** `POST /api/v1/payments/process`

**Description:** Process a payment to a user (e.g., payment for waste collection)

**Authentication:** Required (Admin/Collection Point)

**Request Body:**
```json
{
  "userId": "user-uuid",
  "amount": 500,
  "currency": "KES",
  "type": "WASTE_COLLECTION",
  "paymentMethod": "MPESA",
  "description": "Payment for waste collection"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "transaction-uuid",
    "status": "PENDING",
    "amount": 500,
    "currency": "KES",
    "paymentMethod": "MPESA"
  },
  "message": "Payment initiated successfully"
}
```

### 2. Request Withdrawal

**Endpoint:** `POST /api/v1/payments/withdraw`

**Description:** User requests to withdraw earnings to mobile money

**Authentication:** Required (User)

**Request Body:**
```json
{
  "amount": 1000,
  "phoneNumber": "+254712345678",
  "paymentMethod": "MPESA"
}
```

**Validation Rules:**
- Minimum withdrawal: KES 100
- Phone number must be in E.164 format
- Payment method must be one of: `MPESA`, `MTN_MONEY`, `AIRTEL_MONEY`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "transaction-uuid",
    "status": "PENDING",
    "amount": 1000,
    "currency": "KES",
    "paymentMethod": "MPESA",
    "phoneNumber": "+254712345678"
  },
  "message": "Withdrawal request submitted successfully"
}
```

### 3. Get Transaction History

**Endpoint:** `GET /api/v1/payments/transactions/me`

**Description:** Get user's transaction history

**Authentication:** Required (User)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "transaction-uuid",
      "amount": 500,
      "currency": "KES",
      "type": "WASTE_COLLECTION",
      "status": "COMPLETED",
      "paymentMethod": "MPESA",
      "createdAt": "2026-01-15T10:30:00Z",
      "completedAt": "2026-01-15T10:30:45Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "summary": {
    "totalTransactions": 45,
    "totalAmount": 22500
  }
}
```

### 4. Retry Failed Payment

**Endpoint:** `POST /api/v1/payments/transactions/:id/retry`

**Description:** Retry a failed payment transaction

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "transaction-uuid",
    "status": "PENDING"
  },
  "message": "Payment retry successful"
}
```

---

## Payment Flow

### Collection Payment Flow (User Receives Money)

1. **Collection Verification**: Admin verifies waste collection
2. **Payment Initiation**: Admin triggers payment processing
3. **Provider Request**: System sends request to mobile money provider
4. **User Prompt**: User receives payment prompt on their phone
5. **User Confirmation**: User enters PIN to accept payment
6. **Callback**: Provider sends callback to confirm transaction
7. **Update Status**: Transaction marked as COMPLETED
8. **Notification**: User receives confirmation

### Withdrawal Flow (User Cashes Out)

1. **Withdrawal Request**: User submits withdrawal request via API
2. **Balance Check**: System verifies user has sufficient Stellar balance
3. **Transaction Create**: System creates WITHDRAWAL transaction
4. **Provider Request**: System sends disbursement request to provider
5. **Provider Processing**: Mobile money provider processes payment
6. **Callback**: Provider sends callback with result
7. **Update Status**: Transaction marked as COMPLETED/FAILED
8. **Notification**: User receives confirmation

---

## Callback Handling

### Why Callbacks?

Mobile money transactions are asynchronous. The provider needs time to:
- Prompt the user
- Wait for user confirmation
- Process the transaction
- Return the result

Callbacks allow the provider to notify us when the transaction is complete.

### Callback URLs

Each provider has a dedicated callback endpoint:

- **M-Pesa**: `POST /api/v1/payments/callbacks/mpesa`
- **MTN**: `POST /api/v1/payments/callbacks/mtn`
- **Airtel**: `POST /api/v1/payments/callbacks/airtel`

### Securing Callbacks

**Important:** Callback endpoints are public (no authentication) because they're called by external providers.

**Security Measures:**
1. **Verify source IP**: Check requests come from provider IPs (to be implemented)
2. **Validate payload**: Ensure payload structure matches expected format
3. **Transaction matching**: Only update transactions that exist and are PENDING
4. **Idempotency**: Handle duplicate callbacks gracefully
5. **Logging**: Log all callback attempts for audit trail

### M-Pesa Callback Format

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 1
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "NLJ7RT61SV"
          },
          {
            "Name": "PhoneNumber",
            "Value": 254708374149
          }
        ]
      }
    }
  }
}
```

### MTN Callback Format

```json
{
  "financialTransactionId": "123456789",
  "externalId": "transaction-uuid",
  "amount": "1000",
  "currency": "UGX",
  "payer": {
    "partyIdType": "MSISDN",
    "partyId": "256772123456"
  },
  "status": "SUCCESSFUL"
}
```

### Airtel Callback Format

```json
{
  "transaction": {
    "id": "transaction-uuid",
    "status": "TS",
    "airtel_money_id": "AIRTEL123456",
    "message": "Transaction successful"
  }
}
```

---

## Testing

### Testing in Sandbox

#### M-Pesa Sandbox

1. Use test credentials from Daraja portal
2. Test phone numbers: `254708374149`, `254708374150`
3. Any 4-digit PIN works in sandbox
4. No real money is transacted

**Test STK Push:**
```bash
curl -X POST http://localhost:3000/api/v1/payments/withdraw \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "phoneNumber": "254708374149",
    "paymentMethod": "MPESA"
  }'
```

#### MTN Sandbox

1. Use sandbox subscription key
2. Create test API user via API
3. Test phone numbers provided by MTN

#### Airtel Sandbox

1. Use sandbox credentials from Airtel
2. Test phone numbers: `+254700000000` to `+254700000010`

### Manual Callback Testing

You can manually test callbacks using curl:

```bash
# Test M-Pesa callback
curl -X POST http://localhost:3000/api/v1/payments/callbacks/mpesa \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "CheckoutRequestID": "ws_CO_191220191020363925",
        "ResultCode": 0,
        "ResultDesc": "Success"
      }
    }
  }'
```

### Monitoring Transactions

Watch transaction status changes:

```bash
# Get transaction history
curl http://localhost:3000/api/v1/payments/transactions/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check specific transaction
curl http://localhost:3000/api/v1/payments/transactions/TRANSACTION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Handling

### Common Errors

#### 1. Provider Not Configured

**Error:**
```json
{
  "success": false,
  "error": "MPESA is not configured"
}
```

**Solution:** Ensure all required environment variables are set for the provider.

#### 2. Insufficient Balance

**Error:**
```json
{
  "success": false,
  "error": "Insufficient balance"
}
```

**Solution:** User needs to collect more waste or reduce withdrawal amount.

#### 3. Invalid Phone Number

**Error:**
```json
{
  "success": false,
  "error": "Invalid phone number"
}
```

**Solution:** Phone number must be in E.164 format (e.g., `+254712345678`).

#### 4. Transaction Timeout

If a transaction remains PENDING for too long (>5 minutes):
- Check provider status
- Review callback logs
- Retry transaction if needed

### Transaction States

- **PENDING**: Awaiting user confirmation or provider callback
- **PROCESSING**: Being processed by provider
- **COMPLETED**: Successfully completed
- **FAILED**: Transaction failed (see `failureReason`)
- **CANCELLED**: Cancelled by user or system

---

## Security Considerations

### 1. Environment Variables

- **Never commit** `.env` file to version control
- Use different credentials for sandbox and production
- Rotate credentials periodically

### 2. API Keys

- Store API keys securely
- Use environment-specific keys
- Monitor API key usage

### 3. Callback Security

- Whitelist provider IP addresses (recommended)
- Validate callback payload structure
- Log all callback attempts
- Implement rate limiting

### 4. Transaction Security

- Verify user owns transaction before allowing retry/cancel
- Implement transaction amount limits
- Monitor for suspicious patterns
- Use HTTPS for all communications

### 5. Phone Number Privacy

- Store phone numbers encrypted
- Don't expose full phone numbers in logs
- Mask phone numbers in API responses

### 6. Testing Security

- Never use production credentials in development
- Keep sandbox and production environments separate
- Test thoroughly before going live

---

## Production Checklist

Before going live with mobile money integration:

- [ ] Obtain production credentials from all providers
- [ ] Update environment variables with production keys
- [ ] Configure production callback URLs (must be HTTPS)
- [ ] Set up callback IP whitelisting
- [ ] Test end-to-end flow in production (with small amounts)
- [ ] Set up monitoring and alerting
- [ ] Document incident response procedures
- [ ] Train support team on mobile money issues
- [ ] Ensure compliance with provider terms of service
- [ ] Implement transaction reconciliation process

---

## Support Resources

### M-Pesa
- [Developer Portal](https://developer.safaricom.co.ke/)
- [Documentation](https://developer.safaricom.co.ke/docs)
- Support: apisupport@safaricom.co.ke

### MTN Mobile Money
- [Developer Portal](https://momodeveloper.mtn.com/)
- [Documentation](https://momodeveloper.mtn.com/api-documentation/)
- Support: Via developer portal

### Airtel Money
- Contact your Airtel Business representative
- [Business Portal](https://www.airtel.africa/business)

---

## Troubleshooting

### Provider Service Not Initializing

**Check:**
1. Environment variables are set correctly
2. No typos in variable names
3. Server logs for initialization errors

### Callbacks Not Received

**Check:**
1. Callback URL is publicly accessible
2. URL is HTTPS (required by most providers)
3. Firewall allows inbound connections
4. Provider has correct callback URL configured

### Transaction Stuck in PENDING

**Actions:**
1. Check provider dashboard for transaction status
2. Review callback logs
3. Query provider API for transaction status
4. Consider retry or manual completion

---

## Need Help?

If you encounter issues:
1. Check the logs: `src/utils/logger.util.ts`
2. Review provider documentation
3. Contact provider support
4. Reach out to WasteFi development team

---

**Last Updated:** 2026-09-13  
**Version:** 1.0.0
