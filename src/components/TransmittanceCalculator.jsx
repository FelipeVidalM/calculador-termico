import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Layers, Wrench, CheckCircle2,
  Plus, Trash2, Search, ChevronRight, ChevronLeft,
  AlertTriangle, Info
} from 'lucide-react';
import {
  BIBLIOTECA, RSI, RSE, PZ, REGIONES_CHILE, U_MAX_OGUC, ELEM_TYPES
} from '../lib/condConstants';

// ── Correcciones Anexo F NCh853.Of2021 ────────────────────────────────────────
const AIR_GAP_LEVELS = [
  { id: 0, label: 'Nivel 0', desc: 'Sin espacios de aire con efecto significativo', dUg: 0 },
  { id: 1, label: 'Nivel 1', desc: 'Espacios de aire sin ventilación apreciable', dUg: 0.01 },
  { id: 2, label: 'Nivel 2', desc: 'Espacios de aire con fuerte ventilación', dUg: 0.04 },
];

const FASTENER_ALPHA = [
  { id: 0, label: 'Sin fijaciones (α = 0)', alpha: 0 },
  { id: 1, label: 'Fijación completa — penetra totalmente (α = 0.8)', alpha: 0.8 },
  { id: 2, label: 'Fijación parcial — embebida en aislante (α = 0.2)', alpha: 0.2 },
];

// Resistencia ventilada bajo cubierta (NCh853 Tabla 3)
const RU_OPTIONS = [
  { id: 0, label: 'Sin espacio ventilado', ru: 0 },
  { id: 1, label: 'Tejas sin fieltro ni placa', ru: 0.06 },
  { id: 2, label: 'Tejas con fieltro o placa', ru: 0.20 },
  { id: 3, label: 'Revestimiento con aluminio', ru: 0.30 },
  { id: 4, label: 'Placas con fieltro', ru: 0.30 },
];

const MAX_LAYERS = 7;
const GROUPS = [...new Set(BIBLIOTECA.map(m => m.g))];

function matR(m, e) {
  if (m.R === 0) return 0;
  if (m.R != null) return m.R;
  if (m.lam && e > 0) return e / m.lam;
  return null;
}

// ── Sub-componente: selector de material ──────────────────────────────────────
function MaterialModal({ onSelect, onClose }) {
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState('');
  const filtered = useMemo(() => {
    return BIBLIOTECA.filter(m => {
      const matchQ = !q || m.n.toLowerCase().includes(q.toLowerCase());
      const matchG = !grp || m.g === grp;
      const hasThermal = m.R !== null || (m.lam != null && m.R !== 0);
      return matchQ && matchG && hasThermal;
    });
  }, [q, grp]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-black/5">
          <p className="text-sm font-bold text-slate-800 mb-3">Seleccionar Material — Biblioteca DITEC / ISO</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                className="w-full pl-8 pr-3 py-2 text-xs border border-black/10 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Buscar material..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <select
              className="text-xs border border-black/10 rounded-xl px-2 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 max-w-[160px]"
              value={grp}
              onChange={e => setGrp(e.target.value)}
            >
              <option value="">Todos los grupos</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map((m, i) => {
            const rLabel = m.R === 0 ? 'R = 0 (capa delgada)' : m.R != null ? `R = ${m.R} m²K/W` : m.lam != null ? `λ = ${m.lam} W/mK` : '—';
            return (
              <button
                key={i}
                onClick={() => onSelect(m)}
                className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 border-b border-black/5 last:border-0 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-800">{m.n}</p>
                <p className="text-[10px] text-slate-500">{m.g} · {rLabel}</p>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-8">Sin resultados</p>
          )}
        </div>
        <div className="p-3 border-t border-black/5">
          <button onClick={onClose} className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 font-semibold">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function TransmittanceCalculator({ sharedProject, setSharedProject }) {
  const [step, setStep] = useState(0);
  const [region, setRegion] = useState('');
  const [provincia, setProvincia] = useState('');
  const [elemType, setElemType] = useState('muro');
  const [desc, setDesc] = useState('');
  const [layers, setLayers] = useState([
    { mat: null, e: 0 },
    { mat: null, e: 0 },
  ]);
  const [modalIdx, setModalIdx] = useState(null);
  const [ruIdx, setRuIdx] = useState(0);

  // Annex F
  const [airGapLevel, setAirGapLevel] = useState(0);
  const [useFasteners, setUseFasteners] = useState(false);
  const [fastener, setFastener] = useState({ alphaIdx: 0, nf: '', lf: '', af: '', d1: '' });
  const [useInvRoof, setUseInvRoof] = useState(false);
  const [invRoof, setInvRoof] = useState({ p: '', r1: '' });

  // ── Zona térmica ──────────────────────────────────────────────────────────
  const activeZona = useMemo(() => {
    if (!provincia) return null;
    for (const [z, provs] of Object.entries(PZ)) {
      if (provs.includes(provincia)) return z;
    }
    return null;
  }, [provincia]);

  // ── Elemento activo ────────────────────────────────────────────────────────
  const activeElem = useMemo(() => ELEM_TYPES.find(e => e.id === elemType) || ELEM_TYPES[0], [elemType]);
  const rsi = useMemo(() => RSI[activeElem.rsiKey] || 0.13, [activeElem]);
  const ru = useMemo(() => (elemType === 'techo' ? (RU_OPTIONS[ruIdx]?.ru ?? 0) : 0), [elemType, ruIdx]);

  // ── Cálculo capas ─────────────────────────────────────────────────────────
  const layerData = useMemo(() => layers.map(l => {
    if (!l.mat) return { r: null, ok: false };
    const r = matR(l.mat, l.e);
    return { r, ok: r !== null };
  }), [layers]);

  const RT = useMemo(() => {
    if (layerData.some(ld => !ld.ok)) return null;
    const sumR = layerData.reduce((acc, ld) => acc + ld.r, 0);
    return RSE + rsi + sumR + ru;
  }, [layerData, rsi, ru]);

  const U0 = useMemo(() => RT ? 1 / RT : null, [RT]);

  // ── Correcciones Anexo F ──────────────────────────────────────────────────
  const dUg = AIR_GAP_LEVELS[airGapLevel]?.dUg ?? 0;

  const dUf = useMemo(() => {
    if (!useFasteners) return 0;
    const alpha = FASTENER_ALPHA[fastener.alphaIdx]?.alpha ?? 0;
    if (alpha === 0) return 0;
    const nf = parseFloat(fastener.nf);
    const lf = parseFloat(fastener.lf);
    const af = parseFloat(fastener.af);
    const d1 = parseFloat(fastener.d1);
    if ([nf, lf, af, d1].some(v => isNaN(v) || v <= 0)) return null;
    // NCh853 Anexo F.3: ΔUf = α × nf × λf × Af / d1  [W/m²K]
    return alpha * nf * lf * af / d1;
  }, [useFasteners, fastener]);

  const dUr = useMemo(() => {
    if (!useInvRoof || elemType !== 'techo') return 0;
    const p = parseFloat(invRoof.p);
    const r1 = parseFloat(invRoof.r1);
    if (isNaN(p) || isNaN(r1) || p <= 0 || r1 <= 0 || !RT) return null;
    // NCh853 Anexo F.4: ΔUr = 0.04 × p × (R1/RT)²
    return 0.04 * p * Math.pow(r1 / RT, 2);
  }, [useInvRoof, invRoof, elemType, RT]);

  const dU = useMemo(() => {
    if (dUf === null || dUr === null) return null;
    return dUg + dUf + dUr;
  }, [dUg, dUf, dUr]);

  const Uc = useMemo(() => {
    if (U0 === null || dU === null) return null;
    return U0 + dU;
  }, [U0, dU]);

  const uMax = useMemo(() => {
    if (!activeZona) return null;
    return U_MAX_OGUC[activeZona]?.[elemType] ?? null;
  }, [activeZona, elemType]);

  const cumple = useMemo(() => {
    if (Uc === null || uMax === null) return null;
    return Uc <= uMax;
  }, [Uc, uMax]);

  // ── Helpers capas ─────────────────────────────────────────────────────────
  const addLayer = () => setLayers(l => [...l, { mat: null, e: 0 }]);
  const removeLayer = i => setLayers(l => l.filter((_, idx) => idx !== i));
  const updateLayer = (i, key, val) => setLayers(l => l.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  const provincias = useMemo(() => {
    if (!region || !REGIONES_CHILE[region]) return [];
    return Object.keys(REGIONES_CHILE[region].provincias);
  }, [region]);

  const canCalc = layerData.length > 0 && layerData.every(l => l.ok);

  // ── Render ────────────────────────────────────────────────────────────────
  const STEPS = [
    { icon: MapPin,       label: 'Emplazamiento' },
    { icon: Layers,       label: 'Capas' },
    { icon: Wrench,       label: 'Correcciones' },
    { icon: CheckCircle2, label: 'Resultados' },
  ];

  return (
    <div className="space-y-6">
      {modalIdx !== null && (
        <MaterialModal
          onSelect={m => { updateLayer(modalIdx, 'mat', m); setModalIdx(null); }}
          onClose={() => setModalIdx(null)}
        />
      )}

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === i;
          const done = step > i;
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                active ? 'bg-emerald-800 text-white shadow-lg' :
                done   ? 'bg-emerald-100 text-emerald-800' :
                         'bg-black/5 text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={13} />
              <span>{s.label}</span>
              {i < STEPS.length - 1 && <ChevronRight size={11} className="ml-1 opacity-40" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>

          {/* ── Step 0: Emplazamiento ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <SectionCard title="Emplazamiento del Proyecto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Región</label>
                    <select
                      className="w-full text-xs border border-black/10 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={region}
                      onChange={e => { setRegion(e.target.value); setProvincia(''); }}
                    >
                      <option value="">— Seleccione región —</option>
                      {Object.keys(REGIONES_CHILE).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Provincia</label>
                    <select
                      className="w-full text-xs border border-black/10 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={provincia}
                      onChange={e => setProvincia(e.target.value)}
                      disabled={!region}
                    >
                      <option value="">— Seleccione provincia —</option>
                      {provincias.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                {activeZona && (
                  <div className="mt-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                    <MapPin size={14} className="text-emerald-700 shrink-0" />
                    <p className="text-xs font-bold text-emerald-800">Zona Térmica <span className="text-lg">{activeZona}</span> — según NCh1079 / OGUC</p>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Tipo de Elemento Constructivo">
                <div className="grid grid-cols-3 gap-3">
                  {ELEM_TYPES.map(et => (
                    <button
                      key={et.id}
                      onClick={() => setElemType(et.id)}
                      className={`py-3 px-4 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer ${
                        elemType === et.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-black/10 bg-white text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      {et.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                  <span>Rsi (interior): <b className="text-slate-700">{rsi} m²K/W</b></span>
                  <span>Rse (exterior): <b className="text-slate-700">{RSE} m²K/W</b></span>
                </div>
              </SectionCard>

              {elemType === 'techo' && (
                <SectionCard title="Espacio Ventilado bajo Cubierta">
                  <select
                    className="w-full text-xs border border-black/10 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={ruIdx}
                    onChange={e => setRuIdx(Number(e.target.value))}
                  >
                    {RU_OPTIONS.map((opt, i) => (
                      <option key={i} value={i}>{opt.label} — Ru = {opt.ru} m²K/W</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">NCh853.Of2021 Tabla 3 — Resistencia adicional por espacio ventilado</p>
                </SectionCard>
              )}

              <SectionCard title="Descripción del Elemento (opcional)">
                <input
                  className="w-full text-xs border border-black/10 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Ej: Muro perimetral exterior vivienda social..."
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </SectionCard>

              <NavButtons onNext={() => setStep(1)} nextLabel="Configurar Capas →" />
            </div>
          )}

          {/* ── Step 1: Capas ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <SectionCard title="Capas del Elemento (exterior → interior)">
                <div className="text-[10px] text-slate-400 mb-3 flex gap-4">
                  <span>Rse = {RSE} m²K/W</span>
                  {elemType === 'techo' && ru > 0 && <span>Ru = {ru} m²K/W</span>}
                  <span>Rsi = {rsi} m²K/W</span>
                </div>

                <div className="space-y-2">
                  {layers.map((layer, i) => {
                    const ld = layerData[i];
                    const needsE = layer.mat && layer.mat.lam != null && layer.mat.R !== 0 && layer.mat.R == null;
                    return (
                      <div key={i} className="border border-black/8 rounded-xl p-3 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">{i + 1}</span>
                          <button
                            onClick={() => setModalIdx(i)}
                            className="flex-1 text-left text-xs px-3 py-2 border border-black/10 rounded-xl bg-white hover:border-emerald-400 transition-colors truncate"
                          >
                            {layer.mat ? layer.mat.n : <span className="text-slate-400">Seleccionar material…</span>}
                          </button>

                          {needsE && (
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                placeholder="e [m]"
                                className="w-20 text-xs px-2 py-2 border border-black/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                value={layer.e || ''}
                                onChange={ev => updateLayer(i, 'e', parseFloat(ev.target.value) || 0)}
                              />
                              <span className="text-[10px] text-slate-400 shrink-0">m</span>
                            </div>
                          )}

                          {layers.length > 1 && (
                            <button onClick={() => removeLayer(i)} className="p-1.5 text-red-400 hover:text-red-600 shrink-0 cursor-pointer">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {layer.mat && (
                          <div className="mt-1.5 flex gap-3 text-[10px] text-slate-500 pl-7">
                            {layer.mat.lam && <span>λ = {layer.mat.lam} W/mK</span>}
                            {layer.mat.R === 0 && <span className="text-amber-600">Capa delgada — R = 0</span>}
                            {layer.mat.R > 0 && <span>R fijo = {layer.mat.R} m²K/W</span>}
                            {ld.ok && ld.r !== null && <span className="text-emerald-700 font-bold">→ R = {ld.r.toFixed(3)} m²K/W</span>}
                            {needsE && layer.e <= 0 && <span className="text-red-500">Ingrese espesor</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {layers.length < MAX_LAYERS && (
                  <button
                    onClick={addLayer}
                    className="mt-3 flex items-center gap-2 text-xs text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                  >
                    <Plus size={13} /> Agregar capa
                  </button>
                )}

                {canCalc && RT !== null && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <StatBox label="RT Total" value={RT.toFixed(4)} unit="m²K/W" color="emerald" />
                    <StatBox label="U sin corregir" value={U0.toFixed(3)} unit="W/m²K" color="teal" />
                  </div>
                )}
              </SectionCard>

              <NavButtons onPrev={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Correcciones Anexo F →" nextDisabled={!canCalc} />
            </div>
          )}

          {/* ── Step 2: Correcciones Anexo F ──────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* ΔUg */}
              <SectionCard title="Corrección por Huecos de Aire — ΔUg (Anexo F.2)">
                <div className="space-y-2">
                  {AIR_GAP_LEVELS.map(lvl => (
                    <label key={lvl.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      airGapLevel === lvl.id ? 'border-emerald-500 bg-emerald-50' : 'border-black/8 hover:border-emerald-200'
                    }`}>
                      <input type="radio" name="airgap" value={lvl.id} checked={airGapLevel === lvl.id} onChange={() => setAirGapLevel(lvl.id)} className="mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">{lvl.label} — ΔUg = {lvl.dUg} W/m²K</p>
                        <p className="text-[11px] text-slate-500">{lvl.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </SectionCard>

              {/* ΔUf */}
              <SectionCard title="Corrección por Fijaciones Mecánicas — ΔUf (Anexo F.3)">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer mb-3">
                  <input type="checkbox" checked={useFasteners} onChange={e => setUseFasteners(e.target.checked)} />
                  Incluir corrección por fijaciones
                </label>
                {useFasteners && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de fijación</label>
                      <select
                        className="w-full text-xs border border-black/10 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        value={fastener.alphaIdx}
                        onChange={e => setFastener(f => ({ ...f, alphaIdx: Number(e.target.value) }))}
                      >
                        {FASTENER_ALPHA.map((a, i) => <option key={i} value={i}>{a.label}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'nf', label: 'nf — Cant. fijaciones/m²', unit: '1/m²' },
                        { key: 'lf', label: 'λf — Conductividad fijación', unit: 'W/mK' },
                        { key: 'af', label: 'Af — Sección transversal', unit: 'm²' },
                        { key: 'd1', label: 'd₁ — Longitud en aislante', unit: 'm' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">{f.label}</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="flex-1 text-xs px-2 py-2 border border-black/10 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              value={fastener[f.key]}
                              onChange={e => setFastener(fv => ({ ...fv, [f.key]: e.target.value }))}
                            />
                            <span className="text-[10px] text-slate-400 shrink-0">{f.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {dUf !== null && dUf > 0 && (
                      <p className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-2 rounded-xl">
                        ΔUf = {dUf.toFixed(4)} W/m²K
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      Fórmula: ΔUf = α × nf × λf × Af / d₁ — NCh853.Of2021 Anexo F.3
                    </p>
                  </div>
                )}
              </SectionCard>

              {/* ΔUr — solo techo */}
              {elemType === 'techo' && (
                <SectionCard title="Corrección por Techo Invertido — ΔUr (Anexo F.4)">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer mb-3">
                    <input type="checkbox" checked={useInvRoof} onChange={e => setUseInvRoof(e.target.checked)} />
                    El aislante está sobre la membrana impermeable (techo invertido)
                  </label>
                  {useInvRoof && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Precipitación media diaria p [mm/día]</label>
                          <input
                            type="number" min="0" step="0.1"
                            className="w-full text-xs px-2 py-2 border border-black/10 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            value={invRoof.p}
                            onChange={e => setInvRoof(r => ({ ...r, p: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">R₁ — Resist. aislante sobre membrana [m²K/W]</label>
                          <input
                            type="number" min="0" step="0.01"
                            className="w-full text-xs px-2 py-2 border border-black/10 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            value={invRoof.r1}
                            onChange={e => setInvRoof(r => ({ ...r, r1: e.target.value }))}
                          />
                        </div>
                      </div>
                      {dUr !== null && dUr > 0 && (
                        <p className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-2 rounded-xl">
                          ΔUr = {dUr.toFixed(4)} W/m²K
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        Fórmula: ΔUr = 0.04 × p × (R₁/RT)² — NCh853.Of2021 Anexo F.4
                      </p>
                    </div>
                  )}
                </SectionCard>
              )}

              {/* Resumen correcciones */}
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="ΔUg" value={dUg.toFixed(3)} unit="W/m²K" color="slate" />
                <StatBox label="ΔUf" value={dUf !== null ? dUf.toFixed(4) : '—'} unit="W/m²K" color="slate" />
                <StatBox label="ΔU total" value={dU !== null ? dU.toFixed(4) : '—'} unit="W/m²K" color="amber" />
              </div>

              <NavButtons onPrev={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Ver Resultados →" />
            </div>
          )}

          {/* ── Step 3: Resultados ────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              {Uc === null ? (
                <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800 font-semibold">Faltan datos en capas o correcciones. Revisa los pasos anteriores.</p>
                </div>
              ) : (
                <>
                  {/* Resultado principal */}
                  <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-2xl p-6 text-white shadow-xl">
                    <p className="text-xs uppercase tracking-widest text-emerald-300 mb-1">Transmitancia Térmica Corregida</p>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-black">{Uc.toFixed(3)}</span>
                      <span className="text-lg text-emerald-300 pb-1">W/m²K</span>
                    </div>
                    <p className="text-xs text-emerald-300 mt-2">
                      {activeElem.label} · Zona {activeZona || '—'} · NCh853.Of2021
                    </p>
                    {desc && <p className="text-xs text-emerald-400 mt-0.5 italic">"{desc}"</p>}
                  </div>

                  {/* Desglose */}
                  <SectionCard title="Desglose del Cálculo">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-black/10">
                            <th className="text-left py-2 pr-4 text-slate-500 font-bold">Componente</th>
                            <th className="text-right py-2 text-slate-500 font-bold">Valor</th>
                            <th className="text-right py-2 pl-2 text-slate-500 font-bold">Unidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          <tr>
                            <td className="py-1.5 pr-4 text-slate-600">Rse (exterior)</td>
                            <td className="text-right font-mono">{RSE.toFixed(3)}</td>
                            <td className="text-right pl-2 text-slate-400">m²K/W</td>
                          </tr>
                          {layers.map((l, i) => layerData[i].ok && (
                            <tr key={i}>
                              <td className="py-1.5 pr-4 text-slate-600 truncate max-w-[180px]">{l.mat?.n ?? '—'}</td>
                              <td className="text-right font-mono">{layerData[i].r.toFixed(4)}</td>
                              <td className="text-right pl-2 text-slate-400">m²K/W</td>
                            </tr>
                          ))}
                          {ru > 0 && (
                            <tr>
                              <td className="py-1.5 pr-4 text-slate-600">Espacio ventilado bajo cubierta (Ru)</td>
                              <td className="text-right font-mono">{ru.toFixed(2)}</td>
                              <td className="text-right pl-2 text-slate-400">m²K/W</td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-1.5 pr-4 text-slate-600">Rsi (interior)</td>
                            <td className="text-right font-mono">{rsi.toFixed(2)}</td>
                            <td className="text-right pl-2 text-slate-400">m²K/W</td>
                          </tr>
                          <tr className="bg-emerald-50">
                            <td className="py-2 pr-4 font-bold text-emerald-800">RT Total</td>
                            <td className="text-right font-mono font-bold text-emerald-800">{RT.toFixed(4)}</td>
                            <td className="text-right pl-2 text-emerald-600">m²K/W</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 pr-4 text-slate-600">U₀ = 1/RT (sin corregir)</td>
                            <td className="text-right font-mono">{U0.toFixed(4)}</td>
                            <td className="text-right pl-2 text-slate-400">W/m²K</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 pr-4 text-slate-600">ΔUg (huecos de aire)</td>
                            <td className="text-right font-mono">{dUg.toFixed(3)}</td>
                            <td className="text-right pl-2 text-slate-400">W/m²K</td>
                          </tr>
                          {useFasteners && dUf !== null && (
                            <tr>
                              <td className="py-1.5 pr-4 text-slate-600">ΔUf (fijaciones)</td>
                              <td className="text-right font-mono">{dUf.toFixed(4)}</td>
                              <td className="text-right pl-2 text-slate-400">W/m²K</td>
                            </tr>
                          )}
                          {useInvRoof && dUr !== null && (
                            <tr>
                              <td className="py-1.5 pr-4 text-slate-600">ΔUr (techo invertido)</td>
                              <td className="text-right font-mono">{dUr.toFixed(4)}</td>
                              <td className="text-right pl-2 text-slate-400">W/m²K</td>
                            </tr>
                          )}
                          <tr className="bg-slate-100">
                            <td className="py-2 pr-4 font-bold text-slate-700">ΔU Total (Anexo F)</td>
                            <td className="text-right font-mono font-bold text-slate-800">{dU !== null ? dU.toFixed(4) : '—'}</td>
                            <td className="text-right pl-2 text-slate-500">W/m²K</td>
                          </tr>
                          <tr className="bg-teal-50">
                            <td className="py-2 pr-4 font-bold text-teal-800">Uc = U₀ + ΔU (corregida)</td>
                            <td className="text-right font-mono font-bold text-teal-800">{Uc.toFixed(3)}</td>
                            <td className="text-right pl-2 text-teal-600">W/m²K</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>

                  {/* Exigencia OGUC */}
                  {activeZona && uMax !== null ? (
                    <div className={`rounded-2xl p-5 border-2 ${cumple ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50'}`}>
                      <div className="flex items-center gap-3">
                        {cumple
                          ? <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                          : <AlertTriangle size={22} className="text-red-600 shrink-0" />
                        }
                        <div>
                          <p className={`text-sm font-black ${cumple ? 'text-emerald-800' : 'text-red-800'}`}>
                            {cumple ? '✓ Cumple exigencia NCh853.Of2021 / OGUC Art.4.1.10' : '✗ No cumple exigencia NCh853.Of2021 / OGUC Art.4.1.10'}
                          </p>
                          <p className={`text-xs mt-0.5 ${cumple ? 'text-emerald-600' : 'text-red-600'}`}>
                            Uc = {Uc.toFixed(3)} W/m²K {cumple ? '≤' : '>'} U_máx = {uMax} W/m²K
                            {' '}({activeElem.label} / Zona {activeZona})
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-black/10 rounded-2xl">
                      <Info size={14} className="text-slate-400 shrink-0" />
                      <p className="text-xs text-slate-500">Selecciona región y provincia en el Paso 1 para verificar cumplimiento OGUC.</p>
                    </div>
                  )}

                  {/* Tabla U_MAX zonas */}
                  <SectionCard title={`Exigencias OGUC — ${activeElem.label} (todas las zonas)`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-black/10">
                            <th className="text-left py-1.5 pr-3 text-slate-500 font-bold">Zona</th>
                            <th className="text-right py-1.5 text-slate-500 font-bold">U_máx [W/m²K]</th>
                            <th className="text-right py-1.5 pl-3 text-slate-500 font-bold">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {Object.entries(U_MAX_OGUC).map(([z, vals]) => {
                            const uMaxZ = vals[elemType];
                            const ok = Uc !== null && uMaxZ !== null ? Uc <= uMaxZ : null;
                            const isActive = z === activeZona;
                            return (
                              <tr key={z} className={isActive ? 'bg-emerald-50 font-bold' : ''}>
                                <td className="py-1.5 pr-3 text-slate-700">{isActive ? `● Zona ${z}` : `Zona ${z}`}</td>
                                <td className="text-right font-mono">{uMaxZ ?? '—'}</td>
                                <td className="text-right pl-3">
                                  {ok === true && <span className="text-emerald-600 font-bold">✓</span>}
                                  {ok === false && <span className="text-red-500 font-bold">✗</span>}
                                  {ok === null && <span className="text-slate-300">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                </>
              )}

              <NavButtons onPrev={() => setStep(2)} />
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatBox({ label, value, unit, color = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    teal:    'bg-teal-50 border-teal-200 text-teal-800',
    slate:   'bg-slate-50 border-slate-200 text-slate-700',
    amber:   'bg-amber-50 border-amber-200 text-amber-800',
  };
  return (
    <div className={`border rounded-xl p-3 ${colors[color] || colors.emerald}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">{label}</p>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] opacity-60">{unit}</p>
    </div>
  );
}

function NavButtons({ onPrev, onNext, nextLabel = 'Siguiente →', nextDisabled = false }) {
  return (
    <div className="flex justify-between pt-2">
      {onPrev
        ? <button onClick={onPrev} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer px-3 py-2 rounded-xl hover:bg-black/5 transition-colors">
            <ChevronLeft size={13} /> Volver
          </button>
        : <div />
      }
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          {nextLabel} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}
