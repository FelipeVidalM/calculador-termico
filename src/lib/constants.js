export const GLASS_TYPES = [
  { id: 'simple', name: 'Vidrio Simple (6mm)', uValue: 5.8, description: 'Vidrio monolítico sin cámara de aire.' },
  { id: 'dvh-aire', name: 'DVH Aire (4-12-4)', uValue: 2.8, description: 'Doble Vidriado Hermético con cámara de aire de 12mm.' },
  { id: 'dvh-lowe', name: 'DVH Low-E (4-12-4)', uValue: 1.8, description: 'DVH con revestimiento de baja emisividad.' },
  { id: 'dvh-argon', name: 'DVH Argón (4-12-4)', uValue: 2.5, description: 'DVH con cámara de gas Argón.' },
];

export const FRAME_TYPES = [
  { id: 'alu-sin-rpt', name: 'Aluminio sin RPT', uValue: 5.7, rpt: false, material: 'metal' },
  { id: 'alu-con-rpt', name: 'Aluminio con RPT', uValue: 3.2, rpt: true, material: 'metal' },
  { id: 'pvc', name: 'PVC (Multicámara)', uValue: 2.2, rpt: true, material: 'pvc' },
  { id: 'madera', name: 'Madera', uValue: 2.0, rpt: true, material: 'madera' },
];

export const SPACER_TYPES = [
  { id: 'alu', name: 'Aluminio (Estándar)', psiValue: 0.06 },
  { id: 'warm-edge', name: 'Warm Edge (Mejorado)', psiValue: 0.04 },
];
