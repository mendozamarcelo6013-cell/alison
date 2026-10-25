/**
 * Caché en memoria con vigencia (stale-while-revalidate) para datos de sólo
 * lectura. Se eligió esto en lugar de TanStack Query porque sólo se necesitan
 * dos lecturas (catálogo y detalle), no hay mutaciones que sincronizar y así
 * no se añade una dependencia al bundle.
 *
 * Contrato de seguridad: la caché sólo alimenta la VISTA (catálogo y detalle).
 * Carrito y checkout consultan siempre la red (`consultarProducto`) y nunca
 * leen de aquí.
 */

interface Entrada<T> {
  valor: T;
  momento: number;
}

export class CacheVigente<T> {
  private readonly entradas = new Map<string, Entrada<T>>();
  private readonly enVuelo = new Map<string, Promise<T>>();
  /** Sube con cada `vaciar`: una respuesta anterior ya no debe guardarse. */
  private generacion = 0;

  constructor(private readonly vigenciaMs: number) {}

  leer(clave: string): T | undefined {
    return this.entradas.get(clave)?.valor;
  }

  /** `true` si hay un valor guardado hace menos que la vigencia. */
  estaVigente(clave: string): boolean {
    const entrada = this.entradas.get(clave);
    return entrada !== undefined && Date.now() - entrada.momento < this.vigenciaMs;
  }

  guardar(clave: string, valor: T): void {
    this.entradas.set(clave, { valor, momento: Date.now() });
  }

  invalidar(clave?: string): void {
    if (clave === undefined) this.entradas.clear();
    else this.entradas.delete(clave);
  }

  /**
   * Ejecuta `cargar` y guarda el resultado. Las llamadas simultáneas con la
   * misma clave comparten una única petición.
   */
  cargar(clave: string, cargar: () => Promise<T>): Promise<T> {
    const pendiente = this.enVuelo.get(clave);
    if (pendiente) return pendiente;

    const generacion = this.generacion;
    const peticion = cargar()
      .then((valor) => {
        if (generacion === this.generacion) this.guardar(clave, valor);
        return valor;
      })
      .finally(() => {
        if (this.enVuelo.get(clave) === peticion) this.enVuelo.delete(clave);
      });
    this.enVuelo.set(clave, peticion);
    return peticion;
  }

  vaciar(): void {
    this.generacion += 1;
    this.entradas.clear();
    this.enVuelo.clear();
  }
}
