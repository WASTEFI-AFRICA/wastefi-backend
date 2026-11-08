import { createHash, randomUUID } from 'crypto';
import { Keypair, xdr } from '@stellar/stellar-sdk';
import { config } from '../config';
import { SorobanContracts } from '../config/soroban-contracts';
import { WalletSecretUtil } from '../utils/wallet-secret.util';
import { pointMaterials } from '../utils/contract-material.util';
import { prisma } from './database.service';
import { SorobanService, ScArg } from './soroban.service';
import { chainInteger, chainVariant } from './collection-chain-context.service';

const LEASE_MS = 180_000;
const HEARTBEAT_MS = 30_000;

/** Testnet custodial point identities. No method returns stored keys to an API. */
export class PointSigningService {
  private static preparing = new Map<string, Promise<Keypair>>();

  static async trusted(pointId: string, material?: string): Promise<string[]> {
    const point = await prisma.collectionPoint.findUnique({
      where: { id: pointId },
      select: { isActive: true, verifiedAt: true, acceptedMaterials: true },
    });
    if (!point?.isActive || !point.verifiedAt) {
      throw new Error('Point signing requires an active, administratively verified point');
    }
    const materials = pointMaterials(point.acceptedMaterials);
    if (material && !materials.includes(material)) {
      throw new Error('Collection material is not accepted by this point');
    }
    return materials;
  }

  /** First writer wins; legacy public-only stellarAddress is left unchanged. */
  static async wallet(pointId: string, create = true): Promise<Keypair> {
    let stored = await prisma.collectionPointWallet.findUnique({ where: { pointId } });
    if (!stored) {
      if (!create) throw new Error('Point signing key is missing');
      const candidate = Keypair.random();
      try {
        await prisma.collectionPointWallet.createMany({
          data: [
            {
              pointId,
              publicKey: candidate.publicKey(),
              secretKey: WalletSecretUtil.encrypt(candidate.secret()),
            },
          ],
          skipDuplicates: true,
        });
      } catch {
        throw new Error('Point signing key could not be stored');
      }
      stored = await prisma.collectionPointWallet.findUniqueOrThrow({ where: { pointId } });
    }
    try {
      if (WalletSecretUtil.isLegacy(stored.secretKey)) throw new Error();
      const signer = Keypair.fromSecret(WalletSecretUtil.decrypt(stored.secretKey));
      if (signer.publicKey() !== stored.publicKey) throw new Error();
      return signer;
    } catch {
      // Do not attach SDK errors, ciphertext or key material to this error.
      throw new Error('Point signing key could not be opened');
    }
  }

  static async signer(
    pointId: string,
    material: string,
    expectedAddress: string
  ): Promise<Keypair> {
    await this.trusted(pointId, material);
    const signer = await this.wallet(pointId, false);
    if (signer.publicKey() !== expectedAddress)
      throw new Error('Point key does not match the pinned identity');
    return signer;
  }

  static async ready(
    pointId: string,
    contracts: SorobanContracts,
    material: string,
    expectedAddress?: string
  ): Promise<Keypair> {
    await this.trusted(pointId, material);
    if (expectedAddress) await this.signer(pointId, material, expectedAddress);
    if (config.stellar.network !== 'testnet')
      throw new Error('Point key provisioning is testnet-only');
    const key = JSON.stringify([
      pointId,
      config.soroban.networkPassphrase,
      contracts.collection_point,
      contracts.waste_transaction,
    ]);
    let pending = this.preparing.get(key);
    if (!pending) {
      pending = this.prepare(pointId, contracts).finally(() => this.preparing.delete(key));
      this.preparing.set(key, pending);
    }
    const prepared = await pending;
    return this.signer(pointId, material, expectedAddress ?? prepared.publicKey());
  }

  private static async prepare(pointId: string, contracts: SorobanContracts): Promise<Keypair> {
    // Reject an old ABI or incorrectly wired deployment before creating/funding a key.
    if (
      (await SorobanService.read(contracts.waste_transaction, 'get_collection_point_contract')) !==
      contracts.collection_point
    ) {
      throw new Error('Point verification registry does not match the configured deployment');
    }
    if (
      (await SorobanService.read(contracts.waste_transaction, 'is_paused')) !== false ||
      (await SorobanService.read(contracts.collection_point, 'is_paused')) !== false
    ) {
      throw new Error('Point verification is paused');
    }
    const materials = await this.trusted(pointId);
    const signer = await this.wallet(pointId);
    const scope = {
      pointId,
      networkPassphrase: config.soroban.networkPassphrase,
      registryContract: contracts.collection_point,
    };
    const where = { point_network_registry: scope };
    await prisma.pointChainRegistration.createMany({ data: [scope], skipDuplicates: true });
    const token = randomUUID();
    const claim = await prisma.pointChainRegistration.updateMany({
      where: { ...scope, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      data: { leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS) },
    });
    if (!claim.count) throw new Error('Point registration is in progress; retry later');

    let lost = false;
    const renew = async () => {
      if (lost) throw new Error('Point registration lease lost');
      const renewed = await prisma.pointChainRegistration.updateMany({
        where: { ...scope, leaseToken: token },
        data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
      });
      if (!renewed.count) {
        lost = true;
        throw new Error('Point registration lease lost');
      }
    };
    let heartbeat = Promise.resolve();
    const timer = setInterval(() => {
      heartbeat = heartbeat.then(renew).catch(() => {
        lost = true;
      });
    }, HEARTBEAT_MS);
    timer.unref();
    const saveHash = async (hash: string | null) => {
      await renew();
      const saved = await prisma.pointChainRegistration.updateMany({
        where: { ...scope, leaseToken: token },
        data: { registrationTxHash: hash },
      });
      if (!saved.count) throw new Error('Point registration lease lost');
    };
    try {
      const binding = await prisma.pointChainRegistration.findUniqueOrThrow({ where });
      const address = ScArg.address(signer.publicKey());
      const find = async () => {
        const value = await SorobanService.read(contracts.collection_point, 'find_point_by_owner', [
          address,
        ]);
        if (value == null) return null;
        const id = chainInteger(value);
        if (id <= 0n) throw new Error('Point registry returned an invalid identity');
        return id;
      };
      let id = await find(); // RPC failure is never interpreted as an absent point.
      if (id === null && binding.registrationTxHash) {
        const result = await SorobanService.lookup(binding.registrationTxHash);
        if (result.status === 'SUCCESS') {
          id = await find();
          if (id === null) throw new Error('Confirmed point registration is not visible');
        } else if (result.status === 'FAILED') await saveHash(null);
        else throw new Error('Point registration outcome is unknown; refusing to register again');
      }
      const reference =
        'wf-point-' + createHash('sha256').update(pointId).digest('hex').slice(0, 20);
      const args = [
        ScArg.string('WasteFi collection point'),
        ScArg.string(reference),
        xdr.ScVal.scvVec(materials.map(ScArg.variant)),
      ];
      if (id === null) {
        await renew();
        await this.trusted(pointId);
        await SorobanService.ensureAccount(signer.publicKey());
        const registered = await SorobanService.invoke(
          contracts.collection_point,
          'register_point',
          [address, ...args],
          signer,
          saveHash
        );
        id = await find();
        if (id === null || id !== chainInteger(registered.value))
          throw new Error('Point registration identity mismatch');
      }
      const readPoint = async () => {
        const value = await SorobanService.read(contracts.collection_point, 'get_point', [
          ScArg.u64(id!),
        ]);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('Point registry returned invalid data');
        const point = value as {
          owner: unknown;
          verification_status: unknown;
          accepted_materials: unknown;
        };
        if (point.owner !== signer.publicKey() || !Array.isArray(point.accepted_materials))
          throw new Error('Point registry owner or materials mismatch');
        return {
          status: chainVariant(point.verification_status),
          materials: point.accepted_materials.map(chainVariant).sort(),
        };
      };
      let point = await readPoint();
      if (!['Unverified', 'Pending', 'Verified'].includes(point.status))
        throw new Error('Point registry verification needs administrative review');
      if (JSON.stringify(point.materials) !== JSON.stringify(materials)) {
        await renew();
        await this.trusted(pointId);
        await SorobanService.ensureAccount(signer.publicKey());
        await SorobanService.invoke(
          contracts.collection_point,
          'update_point',
          [ScArg.u64(id), ...args],
          signer
        );
      }
      if (point.status !== 'Verified') {
        await renew();
        await this.trusted(pointId);
        await SorobanService.invoke(
          contracts.collection_point,
          'verify_point',
          [ScArg.u64(id)],
          SorobanService.adminKeypair()
        );
      }
      point = await readPoint();
      if (
        point.status !== 'Verified' ||
        JSON.stringify(point.materials) !== JSON.stringify(materials)
      ) {
        throw new Error('Point registry preparation did not complete');
      }
      return signer;
    } finally {
      clearInterval(timer);
      await heartbeat;
      await prisma.pointChainRegistration.updateMany({
        where: { ...scope, leaseToken: token },
        data: { leaseToken: null, leaseUntil: null },
      });
    }
  }
}
