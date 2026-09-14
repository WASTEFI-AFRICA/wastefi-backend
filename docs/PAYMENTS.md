# Payment Processing Guide

## Overview

WasteFi's payment system processes waste collection payments via Stellar blockchain, with plans for mobile money integration. Payments are fast, low-cost, and transparent.

## Features

✅ **Stellar Payments** - Fast, low-cost blockchain payments
✅ **Automatic Processing** - Payments triggered after collection verification
✅ **Multi-Currency** - KES (Kenyan Shillings) with XLM conversion
✅ **Transaction Tracking** - Complete payment history and status
✅ **Withdrawal System** - Cash out to mobile money
✅ **Retry Logic** - Automatic retry for failed payments
✅ **Payment Statistics** - Analytics and reporting

## Payment Flow

```
Collection Verified → Calculate Payment → Convert KES to XLM →
Send Stellar Transaction → Record Transaction → Update Collection Status →
Notify Collector
```

## API Endpoints

### Process Collection Payment (Admin)

```bash
POST /api/v1/payments/process
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "collectionId": "col-123"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "txn-456",
    "userId": "user-789",
    "amount": 637.5,
    "currency": "KES",
    "type": "WASTE_COLLECTION",
    "status": "COMPLETED",
    "paymentMethod": "STELLAR",
    "stellarTxHash": "abc123...",
    "description": "Payment for waste collection at Nairobi Central",
    "metadata": {
      "collectionId": "col-123",
      "materialType": "PET",
      "weight": 25.5,
      "xlmAmount": "41.13"
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:05Z"
  },
  "message": "Payment processed successfully"
}
```

### Get Transaction History

```bash
GET /api/v1/payments/transactions/me?page=1&limit=20
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "txn-456",
      "amount": 637.5,
      "currency": "KES",
      "type": "WASTE_COLLECTION",
      "status": "COMPLETED",
      "paymentMethod": "STELLAR",
      "stellarTxHash": "abc123...",
      "description": "Payment for waste collection",
      "createdAt": "2024-01-15T10:30:00Z",
      "completedAt": "2024-01-15T10:30:05Z"
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
    "totalAmount": 28650.0
  }
}
```

### Get Transaction by ID

```bash
GET /api/v1/payments/transactions/txn-456
Authorization: Bearer <token>
```

### Request Withdrawal

```bash
POST /api/v1/payments/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 5000,
  "phoneNumber": "+254712345678",
  "paymentMethod": "MPESA"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "txn-789",
    "amount": 5000,
    "currency": "KES",
    "type": "WITHDRAWAL",
    "status": "PENDING",
    "paymentMethod": "MPESA",
    "phoneNumber": "+254712345678",
    "description": "Withdrawal to MPESA - +254712345678"
  },
  "message": "Withdrawal request submitted successfully"
}
```

### Retry Failed Payment (Admin)

```bash
POST /api/v1/payments/transactions/txn-456/retry
Authorization: Bearer <admin-token>
```

### Cancel Transaction

```bash
DELETE /api/v1/payments/transactions/txn-456
Authorization: Bearer <token>
```

**Note:** Can only cancel transactions with status "PENDING".

### Get Payment Statistics (Admin)

```bash
GET /api/v1/payments/statistics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin-token>
```

Response:

```json
{
  "success": true,
  "data": {
    "totalVolume": 2850000.00,
    "totalCount": 1250,
    "byType": {
      "WASTE_COLLECTION": {
        "count": 1200,
        "volume": 2750000.00
      },
      "WITHDRAWAL": {
        "count": 45,
        "volume": 95000.00
      },
      "BONUS": {
        "count": 5,
        "volume": 5000.00
      }
    },
    "byMethod": {
      "STELLAR": {
        "count": 1200,
        "volume": 2750000.00
      },
      "MPESA": {
        "count": 45,
        "volume": 95000.00
      }
    },
    "recentTransactions": [...]
  }
}
```

## Transaction Types

- **WASTE_COLLECTION** - Payment for waste delivery
- **PAYMENT** - General payment
- **WITHDRAWAL** - Cash out to mobile money
- **REFUND** - Payment refund
- **BONUS** - Bonus payment

## Transaction Status

- **PENDING** - Created, awaiting processing
- **PROCESSING** - Payment in progress
- **COMPLETED** - Payment successful
- **FAILED** - Payment failed (can retry)
- **CANCELLED** - Cancelled by user or admin

## Payment Methods

- **STELLAR** - Stellar blockchain (XLM)
- **MPESA** - M-Pesa mobile money (coming soon)
- **MTN_MONEY** - MTN Mobile Money (coming soon)
- **AIRTEL_MONEY** - Airtel Money (coming soon)
- **BANK_TRANSFER** - Bank transfer (future)

## Currency Conversion

### KES to XLM

The system automatically converts KES to XLM for Stellar payments using current exchange rates.

**Current Rate:** 1 XLM ≈ KES 15.5

**Example:**

```
Payment: KES 637.50
Rate: 1 XLM = KES 15.5
XLM Amount: 637.50 / 15.5 = 41.13 XLM
```

### Real-time Rates

In production, integrate with:

- Stellar DEX
- Cryptocurrency exchanges
- Forex APIs

## Payment Processing

### Automatic Processing

Collections are automatically paid after verification:

1. **Admin verifies collection**
2. **System calculates payment**
3. **Converts KES to XLM**
4. **Creates wallet if needed**
5. **Sends Stellar payment**
6. **Records transaction**
7. **Updates collection status**
8. **Sends SMS notification**

### Manual Processing

Admin can manually trigger payment:

```javascript
const processPayment = async (collectionId) => {
  const response = await fetch('/api/v1/payments/process', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collectionId }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('Payment processed:', result.data.stellarTxHash);
  }
};
```

## Withdrawal System

### How It Works

1. **Collector requests withdrawal**
2. **System checks Stellar balance**
3. **Validates minimum amount (KES 100)**
4. **Creates withdrawal transaction**
5. **Processes via mobile money** (coming in Commit 10)
6. **Updates transaction status**
7. **Sends confirmation SMS**

### Withdrawal Limits

- **Minimum:** KES 100
- **Maximum:** Based on available balance
- **Fee:** TBD (to be set by admin)
- **Processing Time:** 1-24 hours

### Example

```javascript
const requestWithdrawal = async (amount, phoneNumber) => {
  const response = await fetch('/api/v1/payments/withdraw', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      phoneNumber: '+254712345678',
      paymentMethod: 'MPESA',
    }),
  });

  const result = await response.json();

  if (result.success) {
    alert(`Withdrawal of KES ${amount} requested. 
           Transaction ID: ${result.data.id}
           Status: ${result.data.status}`);
  }
};
```

## Error Handling

### Common Errors

**Insufficient Balance**

```json
{
  "success": false,
  "error": "Insufficient balance"
}
```

**Collection Not Verified**

```json
{
  "success": false,
  "error": "Collection not yet verified"
}
```

**Payment Already Completed**

```json
{
  "success": false,
  "error": "Payment already completed"
}
```

**Wallet Not Found**

```json
{
  "success": false,
  "error": "User wallet not found"
}
```

### Retry Logic

Failed payments can be retried:

```javascript
const retryPayment = async (transactionId) => {
  const response = await fetch(`/api/v1/payments/transactions/${transactionId}/retry`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  return await response.json();
};
```

## Transaction Records

### Fields

- **id** - Transaction UUID
- **userId** - Collector/user ID
- **amount** - Amount in base currency
- **currency** - Currency code (KES, XLM)
- **type** - Transaction type
- **status** - Current status
- **paymentMethod** - Payment method used
- **stellarTxHash** - Stellar transaction hash
- **mobileMoneyRef** - Mobile money reference
- **phoneNumber** - Phone number (for withdrawals)
- **description** - Human-readable description
- **metadata** - Additional data (JSON)
- **failureReason** - Error message if failed
- **createdAt** - When transaction was created
- **completedAt** - When transaction completed

### Example Record

```json
{
  "id": "txn-456",
  "userId": "user-789",
  "amount": 637.5,
  "currency": "KES",
  "type": "WASTE_COLLECTION",
  "status": "COMPLETED",
  "paymentMethod": "STELLAR",
  "stellarTxHash": "abc123...def456",
  "description": "Payment for waste collection at Nairobi Central",
  "metadata": {
    "collectionId": "col-123",
    "materialType": "PET",
    "weight": 25.5,
    "xlmAmount": "41.13"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:05Z"
}
```

## Mobile App Integration

### Display Transaction History

```javascript
const TransactionList = () => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    const response = await fetch('/api/v1/payments/transactions/me?page=1&limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { data } = await response.json();
    setTransactions(data);
  };

  return (
    <div>
      <h2>Transaction History</h2>
      {transactions.map((txn) => (
        <div key={txn.id}>
          <p>{txn.description}</p>
          <p>KES {txn.amount}</p>
          <p>{txn.status}</p>
          <p>{new Date(txn.createdAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
};
```

### Request Withdrawal

```javascript
const WithdrawalForm = () => {
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch('/api/v1/payments/withdraw', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        phoneNumber,
        paymentMethod: 'MPESA',
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert('Withdrawal requested successfully!');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        placeholder="Amount (min KES 100)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        min="100"
      />
      <input
        type="tel"
        placeholder="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      <button type="submit">Request Withdrawal</button>
    </form>
  );
};
```

## Security

### Payment Authorization

- Only admins can process collection payments
- Users can only view their own transactions
- Withdrawal requires authentication
- Transaction cancellation restricted to owners

### Stellar Security

- Private keys encrypted in database
- Keys never exposed via API
- Transactions signed locally
- Blockchain provides immutability

### Fraud Prevention

- Minimum withdrawal limits
- Transaction monitoring
- Unusual pattern detection
- Manual review for large amounts

## Performance

### Stellar Network

- **Transaction Time:** 3-5 seconds
- **Confirmation:** 1-3 ledgers (~5-15 seconds)
- **Fees:** ~$0.00001 per transaction
- **Throughput:** 1000+ TPS

### Optimization

✅ Batch payments when possible
✅ Cache exchange rates
✅ Async processing for withdrawals
✅ Queue system for high volume
✅ Retry failed transactions automatically

## Monitoring

### Key Metrics

Track these metrics:

- Payment success rate
- Average processing time
- Failed payment rate
- Total volume processed
- Withdrawal processing time

### Alerts

Set up alerts for:

- Payment failure rate > 5%
- Transaction processing > 30 seconds
- Withdrawal queue backlog
- Master wallet low balance

## Testing

### Test Payments

```bash
# Test collection payment
curl -X POST http://localhost:3000/api/v1/payments/process \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"collectionId": "col-123"}'

# Test withdrawal request
curl -X POST http://localhost:3000/api/v1/payments/withdraw \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "phoneNumber": "+254712345678",
    "paymentMethod": "MPESA"
  }'
```

## Best Practices

### For Collectors

✅ Wait for verification before expecting payment
✅ Ensure wallet is set up
✅ Check transaction history regularly
✅ Withdraw when balance is sufficient
✅ Save transaction receipts

### For Admins

✅ Process payments within 24 hours
✅ Monitor failed payments
✅ Review large withdrawals
✅ Keep master wallet funded
✅ Track payment statistics

### For Developers

✅ Handle payment failures gracefully
✅ Implement retry logic
✅ Show clear transaction status
✅ Cache exchange rates
✅ Log all payment operations
✅ Test on testnet first

## Future Enhancements

- [ ] Mobile money integration (Commit 10)
- [ ] Automatic payment scheduling
- [ ] Batch payment processing
- [ ] Multi-signature payments
- [ ] Payment escrow system
- [ ] Instant withdrawals
- [ ] Payment notifications via WebSocket
- [ ] Custom payment schedules
- [ ] Payment split (referrals, bonuses)
- [ ] Cryptocurrency price hedging

## Troubleshooting

### Payment Stuck in Processing

**Check:**

- Stellar network status
- Master wallet balance
- Transaction hash on blockchain
- Error logs

### Withdrawal Not Received

**Steps:**

1. Check transaction status
2. Verify phone number
3. Check mobile money account
4. Contact mobile money provider
5. Wait 24 hours before escalating

### Transaction Failed

**Common Causes:**

- Insufficient balance
- Network issues
- Invalid wallet address
- Rate limit exceeded

**Solution:**

- Check error message
- Retry transaction
- Contact support if persists

## Support

For payment issues:

- Check transaction status first
- Review error messages
- Check Stellar explorer
- Contact support with transaction ID
