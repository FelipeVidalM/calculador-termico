import { RSE } from './condConstants';

/**
 * Presión de saturación de vapor de agua Psat (Pa) en función de T (°C)
 */
export function pSat(T) {
  return 610.5 * Math.exp((17.269 * T) / (T + 237.3));
}

/**
 * Temperatura de punto de rocío Tdew (°C) en función de T (°C) y HR (0 a 1)
 */
export function Tdew(T, phi) {
  const pv = phi * pSat(T);
  if (pv <= 0) return -50; // Evitar indeterminaciones
  const logRatio = Math.log(pv / 610.5);
  return (237.3 * logRatio) / (17.269 - logRatio);
}

/**
 * Resistencia térmica de una capa m2K/W
 */
export function matR(m, e) {
  if (!m) return 0;
  if (m.R != null) return m.R;
  if (m.lam && e) return e / m.lam;
  return 0;
}

/**
 * Espesor de aire equivalente frente a la difusión de vapor Sd (m)
 */
export function matSd(m, e) {
  if (!m) return 0;
  if (m.sd != null) return m.sd;
  const mu = m.mu || 1;
  return mu * (e || 0);
}

/**
 * Formatea el factor mu o Sd para ser mostrado
 */
export function matMuDisp(m) {
  if (!m) return '–';
  if (m.sd != null) return `Sd=${m.sd}m`;
  if (m.R != null) return `R=${m.R}`;
  if (m.mu != null) {
    return `μ=${
      m.mu >= 1000
        ? m.mu.toLocaleString('es-CL', { maximumFractionDigits: 0 })
        : Number(m.mu.toFixed(3))
    }`;
  }
  return '–';
}

/**
 * Realiza el cálculo detallado de condensación para un caso
 */
export function calcCase({ layers, Te, HRe, Ti, HRi_list, Rsi, getMat }) {
  // 1. Filtrar y preparar capas válidas de exterior a interior
  const capas = layers
    .map((l) => {
      const m = getMat(l.mi) || { n: '–', lam: 0.5, mu: 1 };
      return {
        nombre: m.n,
        e: l.e,
        R: matR(m, l.e),
        Sd: matSd(m, l.e),
        barrera: m.barrera,
      };
    })
    .filter((c) => c.e > 0 || c.R > 0);

  const RT_capas = capas.reduce((s, c) => s + c.R, 0);
  const RT = Rsi + RT_capas + RSE;
  const Sd_total = capas.reduce((s, c) => s + c.Sd, 0);

  // 2. Construir los puntos de evaluación en interfases
  // (Punto 0 = Superficie Exterior ... Puntos intermedios ... Punto N = Superficie Interior)
  let pts = [
    {
      T: Te + ((Ti - Te) * RSE) / RT,
      R_acum: RSE,
      Sd_acum: 0,
      nombre: 'Sup. exterior',
    },
  ];

  let Ra = RSE;
  let Sa = 0;

  capas.forEach((c) => {
    Ra += c.R;
    Sa += c.Sd;
    pts.push({
      T: Te + ((Ti - Te) * Ra) / RT,
      R_acum: Ra,
      Sd_acum: Sa,
      nombre: c.nombre,
    });
  });

  const T_si = pts[pts.length - 1].T;

  // 3. Evaluar condensación superficial a distintas humedades relativas interiores
  const supRes = HRi_list.map((phi) => {
    const Td = Tdew(Ti, phi);
    const cond = T_si <= Td;
    // RT mínimo requerido para evitar condensación: Rsi * (Ti - Te) / (Ti - Td)
    const RT_min = ((Ti - Te) / (Ti - Td)) * Rsi;
    return { phi, cond, RT_min };
  });

  // Humedad relativa interior crítica que gatillaría condensación superficial
  const HR_cond_sup = pSat(T_si) / pSat(Ti);

  // 4. Evaluar condensación intersticial a distintas humedades relativas interiores
  const Pe = HRe * pSat(Te);
  const intRes = HRi_list.map((phi) => {
    const Pi = phi * pSat(Ti);
    const ifaces = pts.map((pt) => {
      // Distribución lineal de presión de vapor en base a Sd acumulado
      const Pv = Pe + ((Pi - Pe) * pt.Sd_acum) / (Sd_total || 1);
      const Psat = pSat(pt.T);
      return {
        nombre: pt.nombre,
        T: pt.T,
        Pv,
        Psat,
        cond: Pv > Psat,
      };
    });
    const cond = ifaces.some((f) => f.cond);
    const nCond = ifaces.filter((f) => f.cond).length;
    return { phi, cond, nCond, ifaces };
  });

  return {
    capas,
    RT,
    RT_capas,
    T_si,
    supRes,
    intRes,
    HR_cond_sup,
    pts,
    Te,
    Ti,
    HRe,
    Rsi,
  };
}
