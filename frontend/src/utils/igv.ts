/** Tasa general del IGV en Perú. Los precios del catálogo ya la incluyen. */
export const TASA_IGV = 18;

export interface DesgloseIgv {
  /** Operación gravada: importe sin IGV. */
  gravada: number;
  igv: number;
  total: number;
}

/**
 * Separa el IGV incluido en un total (precio final). Trabaja en céntimos para
 * que gravada + igv sea exactamente el total, igual que el backend.
 */
export function desglosarIgv(total: number, tasa = TASA_IGV): DesgloseIgv {
  const totalCentimos = Math.round(total * 100);
  const igvCentimos = Math.round((totalCentimos * tasa) / (100 + tasa));
  return {
    gravada: (totalCentimos - igvCentimos) / 100,
    igv: igvCentimos / 100,
    total: totalCentimos / 100,
  };
}
