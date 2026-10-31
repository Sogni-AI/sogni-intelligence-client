import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SogniClientWrapper } from '../src/client/SogniClientWrapper.js';

for (const premiumCredit of ['6.96', '0']) {
  test(`getBalance preserves Premium Spark ${premiumCredit} separately from total Spark`, async () => {
    const wrapper = new SogniClientWrapper({ apiKey: 'test-api-key', autoConnect: false });
    let refreshCalls = 0;
    (wrapper as any).client = {
      account: {
        refreshBalance: async () => {
          refreshCalls += 1;
          return {
            sogni: { net: '0.22' },
            spark: { net: '1756.40', premiumCredit },
          };
        },
      },
    };
    (wrapper as any).connectionState = { isConnected: true };

    const balance = await wrapper.getBalance();

    assert.equal(balance.spark, 1756.4);
    assert.equal(balance.premiumSpark, Number(premiumCredit));
    assert.equal(balance.sogni, 0.22);
    assert.ok(balance.lastUpdated instanceof Date);
    assert.equal(refreshCalls, 1);
  });
}
