import { config } from '../../../src/config';

function configuredMode(value?: string): string {
  const saved = process.env.SOROBAN_PAYMENT_MODE;
  if (value === undefined) delete process.env.SOROBAN_PAYMENT_MODE;
  else process.env.SOROBAN_PAYMENT_MODE = value;
  try {
    let mode = '';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mode = require('../../../src/config').config.soroban.paymentMode;
    });
    return mode;
  } finally {
    if (saved === undefined) delete process.env.SOROBAN_PAYMENT_MODE;
    else process.env.SOROBAN_PAYMENT_MODE = saved;
  }
}

describe('payout mode configuration', () => {
  it('derives payouts on-chain by default for the built-in deployment', () => {
    expect(configuredMode()).toBe('derived_v1');
  });

  it('accepts derived payouts explicitly', () => {
    expect(configuredMode('derived_v1')).toBe('derived_v1');
  });

  it('retains an explicit legacy override', () => {
    expect(configuredMode('caller_amount_v1')).toBe('caller_amount_v1');
  });

  it('rejects unknown modes without changing the running configuration', () => {
    const running = config.soroban.paymentMode;
    expect(() => configuredMode('whatever')).toThrow('SOROBAN_PAYMENT_MODE');
    expect(config.soroban.paymentMode).toBe(running);
  });
});
