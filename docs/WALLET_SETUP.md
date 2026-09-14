# Wallet Setup Guide

## Quick Start

Your platform master wallet has been created and funded on testnet! 🎉

### Master Wallet Details

**Public Key:** `GB5ITNC2FBPU6E6624K7E5PHCDUOWZQIM5N6ANNHKSB56LM6MATAVMTF`
**Network:** Testnet
**Status:** Funded with 10,000 XLM

## Testing the Wallet Integration

### 1. Register a User and Create Wallet

```bash
# Register user
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json

{
  "phoneNumber": "+254712345678",
  "firstName": "Test",
  "lastName": "User",
  "email": "test@example.com"
}
```

Save the `accessToken` from the response.

### 2. Create User Wallet

```bash
# Create wallet for user
POST http://localhost:3000/api/v1/wallet/create
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "publicKey": "GXXXXXXX...",
    "network": "testnet",
    "message": "Wallet created and funded on testnet"
  }
}
```

### 3. Check Balance

```bash
GET http://localhost:3000/api/v1/wallet/balance
Authorization: Bearer <accessToken>
```

### 4. Send Test Payment

```bash
POST http://localhost:3000/api/v1/wallet/send
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "destinationPublicKey": "GXXXXXXX...",
  "amount": "10.5",
  "memo": "Test payment"
}
```

## Generating New Wallets

To generate a new master wallet or additional wallets:

```bash
npm run stellar:generate-wallet
```

This will output:

- Public key (safe to share)
- Secret key (keep private!)

## Moving to Mainnet

When ready for production:

1. **Generate a new mainnet wallet**

   ```bash
   npm run stellar:generate-wallet
   ```

2. **Fund the wallet**
   - Send at least 2 XLM to the public key
   - Minimum balance: 1 XLM (recommend 100+ XLM for operations)

3. **Update .env**

   ```env
   STELLAR_NETWORK=mainnet
   STELLAR_HORIZON_URL=https://horizon.stellar.org
   STELLAR_MASTER_SECRET=<your-mainnet-secret>
   ```

4. **Security checklist**
   - [ ] Store secret key in secure vault
   - [ ] Never commit secret to git
   - [ ] Backup secret in multiple locations
   - [ ] Enable monitoring for the wallet
   - [ ] Setup alerts for low balance

## Wallet Architecture

```
Platform Master Wallet (Your wallet)
    ↓ (Sends payments)
User Wallets (Auto-created)
    ├── Collector 1
    ├── Collector 2
    ├── Collector 3
    └── ...
```

## Payment Flow

1. User collects waste → System verifies
2. Platform calculates payment amount
3. Master wallet sends XLM to user wallet
4. Transaction recorded with hash
5. User receives SMS notification

## Security Features

✅ **Encrypted Storage** - All private keys encrypted with AES-256
✅ **Secure Generation** - Cryptographically random keypairs
✅ **No Key Export** - Secret keys never exposed via API
✅ **Transaction Signing** - All transactions signed locally
✅ **Audit Trail** - All transactions on blockchain

## Monitoring

Track these metrics:

- **Master wallet balance** - Alert if < 100 XLM
- **Failed transactions** - Investigate causes
- **Transaction volume** - Daily/weekly trends
- **Average payment size** - Monitor for anomalies

## Troubleshooting

### "Account not funded"

- For testnet: Use friendbot
- For mainnet: Send XLM to the public key

### "Insufficient balance"

- Check master wallet balance
- Remember 0.5 XLM per account as base reserve

### "Transaction failed"

- Check Stellar network status
- Verify account sequence numbers
- Check transaction limits

## Useful Commands

```bash
# Check master wallet balance
curl https://horizon-testnet.stellar.org/accounts/GB5ITNC2FBPU6E6624K7E5PHCDUOWZQIM5N6ANNHKSB56LM6MATAVMTF

# View transactions
curl https://horizon-testnet.stellar.org/accounts/GB5ITNC2FBPU6E6624K7E5PHCDUOWZQIM5N6ANNHKSB56LM6MATAVMTF/transactions

# Test with Stellar Laboratory
https://laboratory.stellar.org
```

## Support

- Stellar Docs: https://developers.stellar.org
- Stellar Discord: https://discord.gg/stellar
- Horizon API: https://developers.stellar.org/api

## Next Steps

1. ✅ Master wallet created and funded
2. ⏳ Test wallet creation for users
3. ⏳ Test payment flows
4. ⏳ Integrate with waste collection
5. ⏳ Setup mobile money bridges
6. ⏳ Deploy to production
