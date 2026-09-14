# Stellar Integration

WasteFi uses the Stellar blockchain for fast, low-cost payments to waste collectors.

## Features

✅ **Automatic Wallet Creation**

- Each user gets a Stellar wallet upon registration
- Testnet accounts are automatically funded
- Private keys encrypted and stored securely

✅ **Payment Processing**

- Send XLM payments to collectors
- Support for memos (transaction notes)
- Transaction tracking and history

✅ **Balance Management**

- Real-time balance queries
- Multi-asset support (XLM + custom tokens)
- Exchange rate conversion (XLM ↔ KES)

## API Endpoints

### Create Wallet

```bash
POST /api/v1/wallet/create
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "data": {
    "publicKey": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "network": "testnet",
    "message": "Wallet created and funded on testnet"
  }
}
```

### Get Balance

```bash
GET /api/v1/wallet/balance
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "data": {
    "publicKey": "GXXXXXXX...",
    "balances": [
      {
        "balance": "10000.0000000",
        "asset": "XLM"
      }
    ]
  }
}
```

### Send Payment

```bash
POST /api/v1/wallet/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "destinationPublicKey": "GXXXXXXX...",
  "amount": "10.5",
  "memo": "Payment for waste collection"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "transactionHash": "abc123..."
  },
  "message": "Payment sent successfully"
}
```

### Get Transaction History

```bash
GET /api/v1/wallet/transactions?limit=20
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "hash": "abc123...",
      "from": "GXXXXXXX...",
      "to": "GYYYYYYY...",
      "amount": "10.5",
      "asset": "XLM",
      "memo": "Payment for waste collection",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get Exchange Rate

```bash
GET /api/v1/wallet/exchange-rate
```

Response:

```json
{
  "success": true,
  "data": {
    "rate": 15.5,
    "from": "XLM",
    "to": "KES",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Configuration

### Environment Variables

```env
# Stellar Configuration
STELLAR_NETWORK=testnet                    # or 'mainnet'
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_MASTER_SECRET=SXXXXXXXXXXXXXXXX   # Platform wallet secret key
```

### Networks

**Testnet** (Development)

- Horizon URL: `https://horizon-testnet.stellar.org`
- Network Passphrase: `Test SDF Network ; September 2015`
- Free XLM from Friendbot

**Mainnet** (Production)

- Horizon URL: `https://horizon.stellar.org`
- Network Passphrase: `Public Global Stellar Network ; September 2015`
- Real XLM required

## Workflow

### Collector Payment Flow

1. **Collector brings waste** to collection point
2. **Waste is verified** and weighed
3. **Payment calculated** based on material type and weight
4. **Stellar payment sent** from platform wallet to collector wallet
5. **Transaction recorded** in database with Stellar hash
6. **SMS notification** sent to collector (offline support)

### Code Example

```typescript
// Process payment for waste collection
const result = await StellarService.processWasteCollectionPayment(
  collectorUserId,
  '10.5', // Amount in XLM
  collectionId // Reference ID
);

if (result.success) {
  console.log('Payment sent:', result.transactionHash);
}
```

## Security Features

🔒 **Private Key Encryption**

- All private keys encrypted with AES-256-CBC
- Encryption key from JWT_SECRET
- Never exposed in API responses

🔒 **Secure Storage**

- Private keys stored encrypted in database
- Public keys safe to share
- Decryption only when needed for transactions

🔒 **Transaction Signing**

- All transactions signed with private key
- Transactions submitted to Stellar network
- Immutable blockchain record

## Benefits of Stellar

✅ **Fast Transactions** - 3-5 second confirmation
✅ **Low Fees** - ~$0.00001 per transaction
✅ **Cross-Border** - Send money anywhere
✅ **Transparent** - All transactions on public ledger
✅ **Decentralized** - No single point of failure
✅ **Asset Support** - Can issue custom tokens

## Asset Issuance (Future)

WasteFi can issue custom tokens for:

- **Waste Credits** - Redeemable for services
- **Impact Tokens** - Represent environmental impact
- **Carbon Credits** - Tradable carbon offsets
- **Loyalty Points** - Rewards for collectors

## Testing on Testnet

### Get Test XLM

Accounts are automatically funded on testnet. You can also manually fund:

```bash
curl https://friendbot.stellar.org?addr=GXXXXXXX...
```

### View Transactions

Use Stellar Laboratory or Explorer:

- https://laboratory.stellar.org
- https://stellarchain.io (testnet)

### Example Wallet

Public Key: `GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
Private Key: `SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

## Production Checklist

Before going to mainnet:

- [ ] Generate secure master wallet
- [ ] Fund master wallet with XLM
- [ ] Change STELLAR_NETWORK to 'mainnet'
- [ ] Update STELLAR_HORIZON_URL to production
- [ ] Test all payment flows
- [ ] Setup monitoring and alerts
- [ ] Implement exchange rate API
- [ ] Setup backup for private keys
- [ ] Configure withdrawal limits
- [ ] Test mobile money integration

## Troubleshooting

### "Account not found"

- Account not yet funded on mainnet
- Fund with at least 1 XLM minimum balance

### "Insufficient balance"

- Account doesn't have enough XLM
- Remember: 0.5 XLM minimum balance required

### "Transaction failed"

- Check network connectivity
- Verify account has sufficient balance
- Check transaction sequence number

## Support

For Stellar integration issues:

- Stellar Docs: https://developers.stellar.org
- Discord: https://discord.gg/stellar
- GitHub: https://github.com/stellar

## Rate Limits

Horizon API rate limits:

- **Public**: 3,600 requests/hour
- **Authenticated**: Higher limits available

## Monitoring

Track these metrics:

- Transaction success rate
- Average transaction time
- Failed transactions
- Wallet balances
- Exchange rate changes
