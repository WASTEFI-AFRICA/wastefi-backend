import * as StellarSdk from '@stellar/stellar-sdk';
import { config } from '../config';
import { EncryptionUtil } from '../utils/encryption.util';
import { prisma } from './database.service';
import BigNumber from 'bignumber.js';

export interface StellarWallet {
  publicKey: string;
  secretKey: string;
}

export interface StellarTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  memo?: string;
  timestamp: Date;
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export class StellarService {
  private static server: StellarSdk.Horizon.Server;
  private static network: StellarSdk.Networks;

  /**
   * Initialize Stellar server connection
   */
  static initialize(): void {
    const horizonUrl = config.stellar.horizonUrl;
    this.server = new StellarSdk.Horizon.Server(horizonUrl);

    // Set network based on configuration
    if (config.stellar.network === 'mainnet') {
      this.network = StellarSdk.Networks.PUBLIC;
    } else {
      this.network = StellarSdk.Networks.TESTNET;
    }

    console.log(`✅ Stellar service initialized (${config.stellar.network})`);
  }

  /**
   * Create a new Stellar wallet
   */
  static createWallet(): StellarWallet {
    const keypair = StellarSdk.Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }

  /**
   * Get wallet from keypair
   */
  static getWalletFromSecret(secret: string): StellarWallet {
    const keypair = StellarSdk.Keypair.fromSecret(secret);
    return {
      publicKey: keypair.publicKey(),
      secretKey: secret,
    };
  }

  /**
   * Fund a testnet account (only works on testnet)
   */
  static async fundTestnetAccount(publicKey: string): Promise<boolean> {
    if (config.stellar.network !== 'testnet') {
      throw new Error('Account funding only available on testnet');
    }

    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
      );
      await response.json();
      console.log('✅ Testnet account funded:', publicKey);
      return true;
    } catch (error) {
      console.error('Failed to fund testnet account:', error);
      return false;
    }
  }

  /**
   * Get account balance
   */
  static async getBalance(publicKey: string): Promise<{ balance: string; asset: string }[]> {
    try {
      const account = await this.server.loadAccount(publicKey);
      return account.balances.map((balance: StellarSdk.Horizon.HorizonApi.BalanceLine) => {
        if ('asset_type' in balance && balance.asset_type === 'native') {
          return {
            balance: balance.balance,
            asset: 'XLM',
          };
        }
        return {
          balance: 'balance' in balance ? balance.balance : '0',
          asset: 'asset_code' in balance ? balance.asset_code : 'UNKNOWN',
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        // Account not yet funded
        return [{ balance: '0', asset: 'XLM' }];
      }
      throw error;
    }
  }

  /**
   * Send payment
   */
  static async sendPayment(
    sourceSecret: string,
    destinationPublicKey: string,
    amount: string,
    memo?: string
  ): Promise<PaymentResult> {
    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
      const sourcePublicKey = sourceKeypair.publicKey();

      // Load source account
      const sourceAccount = await this.server.loadAccount(sourcePublicKey);

      // Build transaction
      let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.network,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationPublicKey,
            asset: StellarSdk.Asset.native(),
            amount: amount,
          })
        )
        .setTimeout(30);

      // Add memo if provided
      if (memo) {
        transaction = transaction.addMemo(StellarSdk.Memo.text(memo));
      }

      const builtTransaction = transaction.build();

      // Sign transaction
      builtTransaction.sign(sourceKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(builtTransaction);

      return {
        success: true,
        transactionHash: result.hash,
      };
    } catch (error) {
      console.error('Payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create and fund user wallet in database
   */
  static async createUserWallet(userId: string): Promise<StellarWallet> {
    // Check if user already has a wallet
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stellarPublicKey: true, stellarSecretKey: true },
    });

    if (user?.stellarPublicKey && user?.stellarSecretKey) {
      // Decrypt existing secret key
      const decryptedSecret = EncryptionUtil.decrypt(user.stellarSecretKey, config.jwt.secret);
      return {
        publicKey: user.stellarPublicKey,
        secretKey: decryptedSecret,
      };
    }

    // Create new wallet
    const wallet = this.createWallet();

    // Encrypt secret key before storing
    const encryptedSecret = EncryptionUtil.encrypt(wallet.secretKey, config.jwt.secret);

    // Update user with wallet info
    await prisma.user.update({
      where: { id: userId },
      data: {
        stellarPublicKey: wallet.publicKey,
        stellarSecretKey: encryptedSecret,
      },
    });

    // If testnet, fund the account
    if (config.stellar.network === 'testnet') {
      await this.fundTestnetAccount(wallet.publicKey);
    }

    console.log(`✅ Created wallet for user ${userId}: ${wallet.publicKey}`);

    return wallet;
  }

  /**
   * Get user wallet from database
   */
  static async getUserWallet(userId: string): Promise<StellarWallet | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stellarPublicKey: true, stellarSecretKey: true },
    });

    if (!user?.stellarPublicKey || !user?.stellarSecretKey) {
      return null;
    }

    // Decrypt secret key
    const decryptedSecret = EncryptionUtil.decrypt(user.stellarSecretKey, config.jwt.secret);

    return {
      publicKey: user.stellarPublicKey,
      secretKey: decryptedSecret,
    };
  }

  /**
   * Process payment for waste collection
   */
  static async processWasteCollectionPayment(
    collectorUserId: string,
    amount: string,
    collectionId: string
  ): Promise<PaymentResult> {
    try {
      // Get master account (platform wallet)
      const masterSecret = config.stellar.masterSecret;
      if (!masterSecret) {
        throw new Error('Master account not configured');
      }

      // Get or create collector wallet
      let collectorWallet = await this.getUserWallet(collectorUserId);
      if (!collectorWallet) {
        collectorWallet = await this.createUserWallet(collectorUserId);
      }

      // Send payment from master account to collector
      const memo = `Waste Collection: ${collectionId.substring(0, 20)}`;
      const result = await this.sendPayment(masterSecret, collectorWallet.publicKey, amount, memo);

      return result;
    } catch (error) {
      console.error('Waste collection payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(
    publicKey: string,
    limit: number = 10
  ): Promise<StellarTransaction[]> {
    try {
      const transactions = await this.server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit)
        .call();

      const history: StellarTransaction[] = [];

      for (const tx of transactions.records) {
        // Get operations for this transaction
        const operations = await this.server.operations().forTransaction(tx.hash).call();

        for (const op of operations.records) {
          if (op.type === 'payment') {
            const paymentOp = op as StellarSdk.Horizon.ServerApi.PaymentOperationRecord;
            history.push({
              hash: tx.hash,
              from: paymentOp.from,
              to: paymentOp.to,
              amount: paymentOp.amount,
              asset: 'XLM',
              memo: tx.memo,
              timestamp: new Date(tx.created_at),
            });
          }
        }
      }

      return history;
    } catch (error) {
      console.error('Failed to fetch transaction history:', error);
      return [];
    }
  }

  /**
   * Check if account exists and is funded
   */
  static async isAccountFunded(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate platform fee (2% of transaction)
   */
  static calculatePlatformFee(amount: string): string {
    const amountBN = new BigNumber(amount);
    const fee = amountBN.multipliedBy(0.02);
    return fee.toFixed(7); // Stellar supports 7 decimal places
  }

  /**
   * Get current XLM price in KES (mock for now)
   */
  static async getXLMtoKESRate(): Promise<number> {
    // TODO: Integrate with real price feed
    // For now, return a fixed rate
    return 15.5; // 1 XLM ≈ 15.5 KES
  }

  /**
   * Convert KES to XLM
   */
  static async convertKEStoXLM(kesAmount: number): Promise<string> {
    const rate = await this.getXLMtoKESRate();
    const xlmAmount = new BigNumber(kesAmount).dividedBy(rate);
    return xlmAmount.toFixed(7);
  }

  /**
   * Convert XLM to KES
   */
  static async convertXLMtoKES(xlmAmount: string): Promise<number> {
    const rate = await this.getXLMtoKESRate();
    const kesAmount = new BigNumber(xlmAmount).multipliedBy(rate);
    return kesAmount.toNumber();
  }
}
