import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PreapprovalValidator } from './preapproval';

const baseData = {
  nit: '12345',
  razonSocial: '',
  ventasAnuales: 1,
  facturasMes: 0,
  ticketPromedio: 1,
  email: 'test@example.com',
  telefono: '',
  consent: true,
};

describe('PreapprovalValidator nit', () => {
  it('accepts at least five numeric characters', () => {
    const result = PreapprovalValidator.safeParse(baseData);
    assert.ok(result.success);
  });

  it('rejects non-numeric characters', () => {
    const result = PreapprovalValidator.safeParse({ ...baseData, nit: '12a45' });
    assert.ok(!result.success);
    if (!result.success) {
      assert.ok(result.error.format().nit?._errors.includes('NIT inválido'));
    }
  });

  it('rejects fewer than five digits', () => {
    const result = PreapprovalValidator.safeParse({ ...baseData, nit: '1234' });
    assert.ok(!result.success);
    if (!result.success) {
      assert.ok(result.error.format().nit?._errors.includes('NIT inválido'));
    }
  });
});
