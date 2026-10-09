/**
 * Navegación de documento completo. Sólo se usa para URLs externas a la SPA
 * (p. ej. el proveedor de pago): dentro de la app se usa `useNavigate`.
 */
export function irA(ruta: string): void {
  window.location.assign(ruta);
}
