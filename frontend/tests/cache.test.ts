import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheVigente } from '../src/api/cache';

describe('CacheVigente', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('conserva el valor vencido pero deja de considerarlo vigente', () => {
    const cache = new CacheVigente<string>(1000);
    cache.guardar('a', 'uno');
    expect(cache.estaVigente('a')).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(cache.estaVigente('a')).toBe(false);
    expect(cache.leer('a')).toBe('uno');
  });

  it('comparte una sola petición entre llamadas simultáneas', async () => {
    const cache = new CacheVigente<number>(1000);
    const cargar = vi.fn(async () => 7);

    const [primera, segunda] = await Promise.all([cache.cargar('k', cargar), cache.cargar('k', cargar)]);

    expect(cargar).toHaveBeenCalledTimes(1);
    expect([primera, segunda]).toEqual([7, 7]);
    expect(cache.leer('k')).toBe(7);
  });

  it('no guarda una respuesta que llega después de invalidar', async () => {
    const cache = new CacheVigente<string>(1000);
    let resolver: (valor: string) => void = () => {};
    const pendiente = cache.cargar('k', () => new Promise<string>((resolve) => { resolver = resolve; }));

    cache.vaciar();
    resolver('dato antiguo');
    await pendiente;

    expect(cache.leer('k')).toBeUndefined();
  });

  it('no cachea los fallos y permite reintentar', async () => {
    const cache = new CacheVigente<string>(1000);
    await expect(cache.cargar('k', async () => { throw new Error('red'); })).rejects.toThrow('red');
    expect(cache.leer('k')).toBeUndefined();
    await expect(cache.cargar('k', async () => 'ok')).resolves.toBe('ok');
  });
});
