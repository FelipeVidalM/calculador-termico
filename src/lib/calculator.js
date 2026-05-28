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
  isSimpleGlass,
  proportionMode = 'frameProfileHeight', // 'directGlassArea', 'frameFactor', 'frameProfileHeight'
  directGlassArea = 0.09, // m²
  frameFactor = 0.30 // fraction
}) {
  const w = width / 1000;
  const h = height / 1000;
  const Aw = w * h;

  let Ag = 0;
  let Af = 0;
  let fw = 0;

  if (proportionMode === 'directGlassArea') {
    Ag = Math.max(0, Math.min(Aw, Number(directGlassArea)));
    Af = Aw - Ag;
    // Estimar ancho de marco equivalente fw asumiendo misma relación de aspecto de la ventana
    const r = w / h;
    const wGlass = Math.sqrt(Ag * r);
    fw = Math.max(0, (w - wGlass) / 2);
  } else if (proportionMode === 'frameFactor') {
    const ff = Math.max(0, Math.min(1, Number(frameFactor)));
    Af = Aw * ff;
    Ag = Aw - Af;
    const r = w / h;
    const wGlass = Math.sqrt(Ag * r);
    fw = Math.max(0, (w - wGlass) / 2);
  } else {
    // Alternativa estándar 3 (Altura de perfil)
    fw = frameWidth / 1000;
    Ag = Math.max(0, (w - 2 * fw) * (h - 2 * fw));
    Af = Aw - Ag;
  }

  // Perímetro del vidrio
  const Lg = 2 * (Math.max(0, w - 2 * fw) + Math.max(0, h - 2 * fw));

  // Transmitancia
  let uw = (Ag * ug + Af * uf + Lg * psi) / Aw;

  // Alerta de Seguridad DITEC
  if (isMetallicWithoutRPT && isSimpleGlass && uw > 5.8) {
    return 5.8;
  }

  return Math.round(uw * 100) / 100;
}
