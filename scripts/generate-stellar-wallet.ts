/**
 * Script to generate a new Stellar wallet for the platform master account
 * Run: npx ts-node scripts/generate-stellar-wallet.ts
 */

import * as StellarSdk from '@stellar/stellar-sdk';

console.log('🔑 Generating new Stellar wallet...\n');

const keypair = StellarSdk.Keypair.random();

console.log('✅ Wallet generated successfully!\n');
console.log('═════════════════════════════════════════════════════');
console.log('Public Key (Safe to share):');
console.log(keypair.publicKey());
console.log('');
console.log('Secret Key (⚠️  KEEP SECRET - Never share):');
console.log(keypair.secret());
console.log('═════════════════════════════════════════════════════\n');

console.log('📝 Next steps:');
console.log('1. Copy the Secret Key above');
console.log('2. Update STELLAR_MASTER_SECRET in your .env file');
console.log('3. For testnet: Fund the account at https://friendbot.stellar.org');
console.log('   curl "https://friendbot.stellar.org?addr=' + keypair.publicKey() + '"');
console.log('4. For mainnet: Send at least 1 XLM to the public key\n');

console.log('⚠️  Security Notes:');
console.log('- Store the secret key securely (password manager, vault)');
console.log('- Never commit secret keys to version control');
console.log('- Backup the secret key in multiple secure locations');
console.log('- The secret key cannot be recovered if lost\n');
