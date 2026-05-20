/**
 * Calcula la transmitancia térmica de una ventana según NCh 3137-1
 * Uw = (Ag*Ug + Af*Uf + Lg*Ψg) / (Ag + Af)
 */
export function calculateUw({
  width,      // mm
  height,     // mm
  frameWidth, // mm
  ug,         // W/m2K
  uf,         // W/m2K
  psi,        // W/mK
  isMetallicWithoutRPT,
  isSimpleGlass
}) {
  const w = width / 1000;
  const h = height / 1000;
  const fw = frameWidth / 1000;

  // Áreas
  const Aw = w * h;
  const Ag = (w - 2 * fw) * (h - 2 * fw);
  const Af = Aw - Ag;

  // Perímetro del vidrio
  const Lg = 2 * ((w - 2 * fw) + (h - 2 * fw));

  // Transmitancia
  let uw = (Ag * ug + Af * uf + Lg * psi) / Aw;

  // Alerta de Seguridad DITEC
  // Si el cálculo de una ventana metálica sin RPT con vidrio simple supera 5.8 W/m2K, debe mostrar 5.8
  if (isMetallicWithoutRPT && isSimpleGlass && uw > 5.8) {
    return 5.8;
  }

  return Math.round(uw * 100) / 100;
}
