const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_SESSION_SECRET = 'secreto-de-prueba-1234567890';

const { slugify, validar, construirWhere } = require('../src/controllers/adminProductoController')._privado;
const { hashPassword, verifyPassword } = require('../src/utils/password');
const { firmarToken, verificarToken } = require('../src/utils/token');

describe('slugify', () => {
  it('normaliza tildes y espacios', () => {
    assert.equal(slugify('Cámara IP Interior'), 'camara-ip-interior');
  });
  it('devuelve fallback si queda vacío', () => {
    assert.match(slugify('---'), /^producto-/);
  });
});

describe('validar producto', () => {
  it('exige nombre y precio al crear', () => {
    assert.ok(validar({}, true).length >= 2);
  });
  it('rechaza precio negativo y stock no entero', () => {
    assert.ok(validar({ nombre: 'X', precio: -1 }, true).length > 0);
    assert.ok(validar({ stock: -2 }, false).length > 0);
  });
  it('rechaza moneda inválida', () => {
    assert.ok(validar({ moneda: 'SOLES' }, false).length > 0);
  });
  it('acepta datos válidos', () => {
    assert.deepEqual(validar({ nombre: 'Laptop', precio: 100, stock: 5, tipo: 'fisico', moneda: 'PEN' }, true), []);
  });
});

describe('construirWhere (paginación/filtros backend)', () => {
  it('mapea estado, categoría y búsqueda', () => {
    const w = construirWhere({ estado: 'publicado', categoria_id: '2', search: 'cam' });
    assert.equal(w.activo, true);
    assert.equal(w.categoria_id, 2);
    assert.ok(Array.isArray(w[Object.getOwnPropertySymbols(w)[0]]));
  });
  it('mapea sinStock y destacados', () => {
    assert.deepEqual(construirWhere({ sinStock: 'true' }), { controla_stock: true, stock: 0 });
    assert.equal(construirWhere({ destacado: 'true' }).destacado, true);
  });
});

describe('password scrypt', () => {
  it('verifica la clave correcta y rechaza otra', () => {
    const h = hashPassword('clave-super-larga-123');
    assert.equal(verifyPassword('clave-super-larga-123', h), true);
    assert.equal(verifyPassword('otra-clave-larga-456', h), false);
  });
  it('rechaza claves cortas', () => {
    assert.throws(() => hashPassword('corta'), /al menos 10/);
  });
});

describe('token admin', () => {
  it('firma y verifica rol admin', () => {
    const t = firmarToken({ sub: 1, email: 'a@b.c', rol: 'admin' }, 60);
    const d = verificarToken(t);
    assert.equal(d.rol, 'admin');
  });
  it('rechaza token manipulado', () => {
    const t = firmarToken({ sub: 1, email: 'a@b.c', rol: 'admin' }, 60);
    assert.equal(verificarToken(`${t}x`), null);
  });
});
