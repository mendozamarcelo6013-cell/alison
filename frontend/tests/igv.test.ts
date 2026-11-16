import { describe, expect, it } from 'vitest';
import { desglosarIgv, TASA_IGV } from '../src/utils/igv';

describe('desglosarIgv', () => {
  it('usa la tasa general del 18 %', () => {
    expect(TASA_IGV).toBe(18);
  });

  it('separa el IGV incluido en el precio final', () => {
    expect(desglosarIgv(118)).toEqual({ gravada: 100, igv: 18, total: 118 });
    expect(desglosarIgv(4999.8)).toEqual({ gravada: 4237.12, igv: 762.68, total: 4999.8 });
  });

  it('la suma de gravada e IGV siempre da el total, sin céntimos perdidos', () => {
    for (const total of [0.01, 9.99, 10, 59.9, 1234.56]) {
      const { gravada, igv } = desglosarIgv(total);
      expect(Math.round((gravada + igv) * 100)).toBe(Math.round(total * 100));
    }
  });
});
