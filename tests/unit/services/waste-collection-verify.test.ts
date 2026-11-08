import { WasteCollectionService } from '../../../src/services/waste-collection.service';

jest.mock('../../../src/services/database.service', () => ({
  __esModule: true,
  prisma: {
    wasteCollection: { findFirst: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  },
}));
jest.mock('../../../src/services/onchain-collection.service', () => ({
  __esModule: true,
  OnChainCollectionService: { enabled: true, kick: jest.fn() },
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const { prisma } = require('../../../src/services/database.service');
const { OnChainCollectionService } = require('../../../src/services/onchain-collection.service');
/* eslint-enable @typescript-eslint/no-var-requires */

describe('WasteCollectionService.verifyCollection and the chain', () => {
  beforeEach(() => {
    prisma.wasteCollection.findFirst.mockResolvedValue({
      id: 'c1',
      verifiedAt: null,
      materialType: 'PET',
      notes: null,
    });
    prisma.wasteCollection.updateMany.mockResolvedValue({ count: 1 });
    prisma.wasteCollection.findUniqueOrThrow.mockResolvedValue({ id: 'c1' });
    OnChainCollectionService.enabled = true;
  });

  it('queues an approved collection for on-chain recording', async () => {
    await WasteCollectionService.verifyCollection('c1', 'verifier', true);

    expect(prisma.wasteCollection.updateMany.mock.calls[0][0].data.chainStatus).toBe('PENDING');
    expect(OnChainCollectionService.kick).toHaveBeenCalledWith('c1');
  });

  it('does not queue a decision that loses the conditional write', async () => {
    prisma.wasteCollection.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      WasteCollectionService.verifyCollection('c1', 'verifier', true)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(OnChainCollectionService.kick).not.toHaveBeenCalled();
  });

  it('does not queue a rejected collection', async () => {
    await WasteCollectionService.verifyCollection('c1', 'verifier', false);

    expect(prisma.wasteCollection.updateMany.mock.calls[0][0].data.chainStatus).toBeUndefined();
    expect(OnChainCollectionService.kick).not.toHaveBeenCalled();
  });

  it('does not queue anything when on-chain recording is off', async () => {
    OnChainCollectionService.enabled = false;

    await WasteCollectionService.verifyCollection('c1', 'verifier', true);

    expect(prisma.wasteCollection.updateMany.mock.calls[0][0].data.chainStatus).toBeUndefined();
    expect(OnChainCollectionService.kick).not.toHaveBeenCalled();
  });
});
