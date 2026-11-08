import { Keypair, rpc, xdr } from '@stellar/stellar-sdk';
import { SorobanService } from '../../../src/services/soroban.service';

it('decodes an explicit Option::None without treating a missing RPC result as absence', async () => {
  jest.spyOn(SorobanService, 'adminKeypair').mockReturnValue(Keypair.random());
  const simulate = jest.spyOn(rpc.Server.prototype, 'simulateTransaction');
  simulate.mockResolvedValue({
    result: { retval: xdr.ScVal.scvVoid() },
  } as rpc.Api.SimulateTransactionSuccessResponse);
  const contract = Keypair.random();
  // Contract IDs and account IDs use different StrKey versions.
  const { StrKey } = await import('@stellar/stellar-sdk');
  const contractId = StrKey.encodeContract(contract.rawPublicKey());
  expect(await SorobanService.read(contractId, 'find_point_by_owner', [])).toBeNull();
  simulate.mockResolvedValue({} as rpc.Api.SimulateTransactionSuccessResponse);
  await expect(SorobanService.read(contractId, 'find_point_by_owner', [])).rejects.toThrow(
    'no simulation result'
  );
});
