import { config } from '../../../src/config';

function configuredFlow(value?: string): string {
  const saved = process.env.SOROBAN_COLLECTION_FLOW;
  if (value === undefined) delete process.env.SOROBAN_COLLECTION_FLOW;
  else process.env.SOROBAN_COLLECTION_FLOW = value;
  try {
    let flow = '';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      flow = require('../../../src/config').config.soroban.collectionFlow;
    });
    return flow;
  } finally {
    if (saved === undefined) delete process.env.SOROBAN_COLLECTION_FLOW;
    else process.env.SOROBAN_COLLECTION_FLOW = saved;
  }
}

describe('collection verification configuration', () => {
  it('selects point ownership for the new built-in deployment', () => {
    expect(configuredFlow()).toBe('point_owner_v1');
  });

  it('retains an explicit legacy override', () => {
    expect(configuredFlow('admin_v1')).toBe('admin_v1');
  });

  it('retains an explicit point override', () => {
    expect(configuredFlow('point_owner_v1')).toBe('point_owner_v1');
  });

  it('rejects unknown flows without changing the running configuration', () => {
    const running = config.soroban.collectionFlow;
    expect(() => configuredFlow('unknown')).toThrow('SOROBAN_COLLECTION_FLOW');
    expect(config.soroban.collectionFlow).toBe(running);
  });
});
