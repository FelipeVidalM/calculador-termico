import { useState, useEffect } from 'react';
import { 
  Wind, 
  User, 
  MapPin, 
  Building, 
  Calendar, 
  Home, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Info,
  Layers,
  ChevronRight,
  Shield,
  Clock,
  Volume2
} from 'lucide-react';

const ABERTURAS_MINIMAS = {
  'Dormitorio Principal': 28,
  'Dormitorios Simples': 14,
  'Estar - Comedor': 52
};

const CAPACIDADES_MINIMAS = {
  'Dormitorio Principal': 7,
  'Dormitorios Simples': 3.5,
  'Estar - Comedor': 13
};

export default function VentilationCalculator({ sharedProject, setSharedProject }) {
  const [activeTab, setActiveTab] = useState('calculo');

  // Form State
  const [propietario, setPropietario] = useState(sharedProject.owner);
  const [direccion, setDireccion] = useState(sharedProject.address);
  const [comuna, setComuna] = useState(sharedProject.commune || 'Santiago');
  const [constructora, setConstructora] = useState('');
  const [patrocinante, setPatrocinante] = useState('');
  const [fecha, setFecha] = useState(sharedProject.fecha);

  // Vivienda State
  const [superficie, setSuperficie] = useState(85);
  const [dormitorios, setDormitorios] = useState(3);
  const [banos, setBanos] = useState(1);
  const [volCocina, setVolCocina] = useState(19.2);
  const [tipoCocina, setTipoCocina] = useState('cerrada'); // 'cerrada' | 'abierta'
  const [tipoBano, setTipoBano] = useState('continuo'); // 'continuo' | 'demanda'
  const [pisos, setPisos] = useState(1);

  // Proyectado State
  const [aberturaProyectada, setAberturaProyectada] = useState(44.15);
  const [capacidadIngreso, setCapacidadIngreso] = useState(11.0375);
  const [extCocina, setExtCocina] = useState(96); // m3/h
  const [extBano, setExtBano] = useState(36); // m3/h

  // Profesional State
  const [profNombre, setProfNombre] = useState(sharedProject.prof);
  const [profRut, setProfRut] = useState(sharedProject.rut);
  const [profTitulo, setProfTitulo] = useState('');
  const [profRegistro, setProfRegistro] = useState('');

  useEffect(() => {
    if (!setSharedProject) return;
    setSharedProject(prev => {
      if (
        prev.owner === propietario &&
        prev.address === direccion &&
        prev.commune === comuna &&
        prev.fecha === fecha &&
        prev.prof === profNombre &&
        prev.rut === profRut
      ) {
        return prev;
      }
      return {
        ...prev,
        owner: propietario,
        address: direccion,
        commune: comuna,
        fecha: fecha,
        prof: profNombre,
        rut: profRut
      };
    });
  }, [propietario, direccion, comuna, fecha, profNombre, profRut, setSharedProject]);

  // Calculations
  const qTotal = 0.15 * superficie + 3.5 * (dormitorios + 1);

  // Ingreso Recintos Secos Calculations
  const recintosIngreso = [
    { nombre: 'Dormitorio Principal', cantidad: 1 },
    { nombre: 'Dormitorios Simples', cantidad: Math.max(0, dormitorios - 1) },
    { nombre: 'Estar - Comedor', cantidad: 1 }
  ].filter(r => r.cantidad > 0);

  let totalMinAbertura = 0;
  let totalMinCap = 0;
  let totalProjAbertura = 0;
  let totalProjCap = 0;
  let cumpleIngreso = true;

  const rowsIngreso = recintosIngreso.map(r => {
    const minAbertura = ABERTURAS_MINIMAS[r.nombre] || 0;
    const minCap = CAPACIDADES_MINIMAS[r.nombre] || 0;
    const reqAbertura = minAbertura * r.cantidad;
    const reqCap = minCap * r.cantidad;
    const projAbertura = aberturaProyectada * r.cantidad;
    const projCap = capacidadIngreso * r.cantidad;

    totalMinAbertura += reqAbertura;
    totalMinCap += reqCap;
    totalProjAbertura += projAbertura;
    totalProjCap += projCap;

    const ok = projAbertura >= reqAbertura && projCap >= reqCap;
    if (!ok) cumpleIngreso = false;

    return {
      nombre: r.nombre,
      cantidad: r.cantidad,
      minAbertura,
      minCap,
      projAbertura,
      projCap,
      ok
    };
  });

  // Extracción Recintos Húmedos Calculations
  const extCocinaLs = extCocina / 3.6;
  const extBanoLs = extBano / 3.6;

  let reqCocinaLs = 0;
  if (tipoCocina === 'cerrada') {
    reqCocinaLs = (5 * volCocina * 1000) / 3600;
  }
  const reqCocinaM3h = reqCocinaLs * 3.6;
  const okCocina = tipoCocina === 'abierta' ? true : extCocinaLs >= reqCocinaLs;

  const reqBanoLs = tipoBano === 'continuo' ? 10 : 25;
  const reqBanoM3h = reqBanoLs * 3.6;
  const projBanoLs = extBanoLs * banos;
  const projBanoM3h = extBano * banos;
  const reqBanoTotalLs = reqBanoLs * banos;
  const reqBanoTotalM3h = reqBanoM3h * banos;
  const okBano = extBanoLs >= reqBanoLs;

  const cumpleExtraccion = okCocina && okBano;

  const totalReqLs = (tipoCocina === 'cerrada' ? reqCocinaLs : 0) + reqBanoTotalLs;
  const totalReqM3h = (tipoCocina === 'cerrada' ? reqCocinaM3h : 0) + reqBanoTotalM3h;
  const totalProjLs = extCocinaLs + projBanoLs;
  const totalProjM3h = extCocina + projBanoM3h;

  const handleLimpiar = () => {
    setPropietario('');
    setDireccion('');
    setComuna('');
    setConstructora('');
    setPatrocinante('');
    setFecha(new Date().toISOString().split('T')[0]);
    setSuperficie(85);
    setDormitorios(3);
    setBanos(1);
    setVolCocina(19.2);
    setTipoCocina('cerrada');
    setTipoBano('continuo');
    setPisos(1);
    setAberturaProyectada(44.15);
    setCapacidadIngreso(11.0375);
    setExtCocina(96);
    setExtBano(36);
    setProfNombre('');
    setProfRut('');
    setProfTitulo('');
    setProfRegistro('');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:space-y-4 print:text-black">
      
      {/* Dynamic Sub-Navigation Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 gap-1 print:hidden max-w-md mx-auto sm:max-w-none sm:w-max">
        {[
          { id: 'calculo', label: 'Cálculo NCh 3309' },
          { id: 'tablas', label: 'Tablas de Referencia' },
          { id: 'norma', label: 'Resumen de Norma' },
          { id: 'info', label: 'Info & Referencias' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-800 text-white shadow-md shadow-emerald-800/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================== TAB: CÁLCULO ===================== */}
      {activeTab === 'calculo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form Inputs */}
          <div className="lg:col-span-7 space-y-6 print:w-full print:block">
            {/* Card 1: Información General */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Información General</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={13} className="text-emerald-700" /> Propietario
                  </label>
                  <input
                    type="text"
                    value={propietario}
                    onChange={(e) => setPropietario(e.target.value)}
                    placeholder="Nombre del propietario"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={13} className="text-emerald-700" /> Dirección
                  </label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Dirección completa de la vivienda"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Building size={13} className="text-emerald-700" /> Comuna
                  </label>
                  <input
                    type="text"
                    value={comuna}
                    onChange={(e) => setComuna(e.target.value)}
                    placeholder="Comuna"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Building size={13} className="text-emerald-700" /> Constructora
                  </label>
                  <input
                    type="text"
                    value={constructora}
                    onChange={(e) => setConstructora(e.target.value)}
                    placeholder="Nombre constructora"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Building size={13} className="text-emerald-700" /> Entidad Patrocinante
                  </label>
                  <input
                    type="text"
                    value={patrocinante}
                    onChange={(e) => setPatrocinante(e.target.value)}
                    placeholder="Entidad patrocinante"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={13} className="text-emerald-700" /> Fecha
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Información de la Vivienda */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Información de la Vivienda</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {/* Superficie Útil */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Superficie Útil de la Vivienda (A<sub>floor</sub>)
                      </label>
                      <span className="text-[10px] text-slate-450 font-mono font-bold">NCh3309 3.23</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={superficie}
                        min="1"
                        step="0.1"
                        onChange={(e) => setSuperficie(parseFloat(e.target.value) || 0)}
                        className="w-full pl-4 pr-12 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50/20 text-slate-800 font-extrabold focus:outline-none focus:border-emerald-700/40 focus:bg-white transition-all duration-250"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">m²</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 leading-normal">
                      Superficie neta del piso de la unidad de vivienda.
                    </span>
                  </div>

                  {/* Dormitorios Counter */}
                  <div className="flex flex-col gap-2 bg-slate-50/40 p-4.5 rounded-2xl border border-slate-100/80">
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                          Número de Dormitorios (N<sub>br</sub>)
                        </label>
                        <span className="text-[10px] text-slate-400 leading-normal block mt-0.5">
                          Mínimo 1. Afecta al caudal total requerido.
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setDormitorios(d => Math.max(1, d - 1))}
                        className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 hover:border-emerald-700/30 text-xl font-bold flex items-center justify-center text-slate-700 hover:text-emerald-800 active:scale-90 hover:bg-slate-50/50 transition-all cursor-pointer shadow-sm"
                      >
                        -
                      </button>
                      <span className="text-2xl font-black text-slate-800 w-12 text-center">{dormitorios}</span>
                      <button
                        type="button"
                        onClick={() => setDormitorios(d => Math.min(5, d + 1))}
                        className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 hover:border-emerald-700/30 text-xl font-bold flex items-center justify-center text-slate-700 hover:text-emerald-800 active:scale-90 hover:bg-slate-50/50 transition-all cursor-pointer shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Baños Counter */}
                  <div className="flex flex-col gap-2 bg-slate-50/40 p-4.5 rounded-2xl border border-slate-100/80">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Número de Baños
                      </label>
                      <span className="text-[10px] text-slate-400 leading-normal block mt-0.5">
                        Determina la cantidad de extractores en baños.
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setBanos(b => Math.max(1, b - 1))}
                        className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 hover:border-emerald-700/30 text-xl font-bold flex items-center justify-center text-slate-700 hover:text-emerald-800 active:scale-90 hover:bg-slate-50/50 transition-all cursor-pointer shadow-sm"
                      >
                        -
                      </button>
                      <span className="text-2xl font-black text-slate-800 w-12 text-center">{banos}</span>
                      <button
                        type="button"
                        onClick={() => setBanos(b => Math.min(10, b + 1))}
                        className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 hover:border-emerald-700/30 text-xl font-bold flex items-center justify-center text-slate-700 hover:text-emerald-800 active:scale-90 hover:bg-slate-50/50 transition-all cursor-pointer shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Volumen Cocina */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Volumen de la Cocina
                      </label>
                      <span className="text-[10px] text-slate-450 font-mono font-bold">Para Cocina Cerrada</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={volCocina}
                        min="1"
                        step="0.1"
                        onChange={(e) => setVolCocina(parseFloat(e.target.value) || 0)}
                        className="w-full pl-4 pr-12 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50/20 text-slate-800 font-extrabold focus:outline-none focus:border-emerald-700/40 focus:bg-white transition-all duration-250"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">m³</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 leading-normal">
                      Necesario para calcular 5 renovaciones de aire por hora (5 ACH) en cocina cerrada.
                    </span>
                  </div>

                  {/* Tipo de Cocina Toggles */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Tipo de Cocina
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setTipoCocina('cerrada')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col gap-1.5 cursor-pointer active:scale-98 ${
                          tipoCocina === 'cerrada'
                            ? 'border-emerald-700 bg-emerald-500/5 shadow-md shadow-emerald-500/5'
                            : 'border-slate-100 bg-slate-50/10 hover:border-slate-200 hover:bg-slate-50/30'
                        }`}
                      >
                        <span className={`text-xs font-black uppercase tracking-wider ${tipoCocina === 'cerrada' ? 'text-emerald-900' : 'text-slate-700'}`}>
                          Cocina Cerrada
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium leading-relaxed">
                          Abertura &lt;= 6m² a recintos contiguos. Requiere flujo continuo de 5 ACH.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTipoCocina('abierta')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col gap-1.5 cursor-pointer active:scale-98 ${
                          tipoCocina === 'abierta'
                            ? 'border-emerald-700 bg-emerald-500/5 shadow-md shadow-emerald-500/5'
                            : 'border-slate-100 bg-slate-50/10 hover:border-slate-200 hover:bg-slate-50/30'
                        }`}
                      >
                        <span className={`text-xs font-black uppercase tracking-wider ${tipoCocina === 'abierta' ? 'text-emerald-900' : 'text-slate-700'}`}>
                          Cocina Abierta
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium leading-relaxed">
                          No aplica flujo continuo mínimo (Tabla 6). Solo extracción local por demanda.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Altura Vivienda Toggles */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Altura de la Vivienda (Pisos)
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPisos(p)}
                          className={`py-3.5 px-2 rounded-2xl border-2 text-center transition-all duration-200 font-extrabold text-xs cursor-pointer active:scale-98 flex flex-col items-center justify-center gap-1 ${
                            pisos === p
                              ? 'border-emerald-700 bg-emerald-500/5 shadow-md shadow-emerald-500/5 text-emerald-900'
                              : 'border-slate-100 bg-slate-50/10 hover:border-slate-200 hover:bg-slate-50/30 text-slate-650'
                          }`}
                        >
                          <span className="text-lg font-black block">{p}</span>
                          <span className="text-[9px] uppercase tracking-wider block font-semibold">{p === 1 ? 'Piso' : 'Pisos'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formula Block & Math Output */}
              <div className="mt-8 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Ecuación NCh 3309 4.1.1 (SI)</h4>
                    <p className="text-[10px] text-emerald-700/80 mt-0.5">Donde: Qtot = L/s | Afloor = m² | Nbr = n dormitorios (mín. 1)</p>
                  </div>
                  <code className="px-3.5 py-1.5 bg-emerald-800 text-white rounded-lg font-mono text-xs font-bold">
                    Qtot = 0,15 × Afloor + 3,5 × (Nbr + 1)
                  </code>
                </div>

                <div className="flex items-center gap-3.5 bg-white border border-emerald-500/20 p-4 rounded-xl shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    OK
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Caudal requerido (Qtot): <span className="text-emerald-800 font-extrabold text-base">{qTotal.toFixed(1)} L/s</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Cálculo: 0.15 × {superficie} + 3.5 × ({dormitorios} + 1) = {qTotal.toFixed(1)} L/s
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Ingreso de Aire (Recintos Secos) */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Ingreso de Aire (Recintos Secos)</h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                6.6.1: Cada espacio habitable debe tener aberturas de ventilación operables &gt;= 4% del área del suelo o &gt;= 0,5m²
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Abertura útil proyectada por recinto
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={aberturaProyectada}
                      min="0"
                      step="0.01"
                      onChange={(e) => setAberturaProyectada(parseFloat(e.target.value) || 0)}
                      className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">cm²</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Capacidad de ingreso proyectada por recinto
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={capacidadIngreso}
                      min="0"
                      step="0.0001"
                      onChange={(e) => setCapacidadIngreso(parseFloat(e.target.value) || 0)}
                      className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">L/s</span>
                  </div>
                </div>
              </div>

              {/* Dry Area Results Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs text-slate-800">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="px-4 py-3.5">Recinto</th>
                      <th className="px-4 py-3.5 text-center">Cant.</th>
                      <th className="px-4 py-3.5 text-right">Abertura mín. (cm²)</th>
                      <th className="px-4 py-3.5 text-right">Capacidad mín. (L/s)</th>
                      <th className="px-4 py-3.5 text-right">Abertura proj. (cm²)</th>
                      <th className="px-4 py-3.5 text-right">Capacidad proj. (L/s)</th>
                      <th className="px-4 py-3.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rowsIngreso.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 font-bold text-slate-700">{row.nombre}</td>
                        <td className="px-4 py-3.5 text-center">{row.cantidad}</td>
                        <td className="px-4 py-3.5 text-right font-mono">{row.minAbertura}</td>
                        <td className="px-4 py-3.5 text-right font-mono">{row.minCap.toFixed(1)}</td>
                        <td className="px-4 py-3.5 text-right font-mono">{row.projAbertura.toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-right font-mono">{row.projCap.toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            row.ok
                              ? 'bg-emerald-500/10 text-emerald-800'
                              : 'bg-rose-500/10 text-rose-800'
                          }`}>
                            {row.ok ? 'Cumple' : 'No Cumple'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-emerald-500/5 font-extrabold text-emerald-800 border-t-2 border-emerald-500/20">
                      <td className="px-4 py-4">TOTAL</td>
                      <td className="px-4 py-4 text-center">-</td>
                      <td className="px-4 py-4 text-right font-mono">{totalMinAbertura}</td>
                      <td className="px-4 py-4 text-right font-mono">{totalMinCap.toFixed(1)}</td>
                      <td className="px-4 py-4 text-right font-mono">{totalProjAbertura.toFixed(2)}</td>
                      <td className="px-4 py-4 text-right font-mono">{totalProjCap.toFixed(2)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          cumpleIngreso
                            ? 'bg-emerald-800 text-white'
                            : 'bg-rose-700 text-white'
                        }`}>
                          {cumpleIngreso ? 'Cumple' : 'No Cumple'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Dry Area Dynamic Alert */}
              <div className={`mt-5 rounded-2xl border p-5 flex items-start gap-4 ${
                cumpleIngreso
                  ? 'bg-emerald-500/5 border-emerald-500/25 text-slate-800'
                  : 'bg-rose-500/5 border-rose-500/25 text-slate-800'
              }`}>
                {cumpleIngreso ? (
                  <CheckCircle2 className="text-emerald-700 mt-0.5 shrink-0" size={20} />
                ) : (
                  <XCircle className="text-rose-700 mt-0.5 shrink-0" size={20} />
                )}
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-wide ${cumpleIngreso ? 'text-emerald-950' : 'text-rose-950'}`}>
                    {cumpleIngreso ? 'DISPOSITIVOS INGRESO DE AIRE: CUMPLE' : 'DISPOSITIVOS INGRESO DE AIRE: NO CUMPLE'}
                  </h4>
                  <div className="text-xs mt-1.5 space-y-1 text-slate-600">
                    <p>
                      Abertura total mínima requerida: <span className="font-extrabold text-slate-800">{totalMinAbertura} cm²</span> | 
                      Proyectada: <span className="font-extrabold text-slate-800">{totalProjAbertura.toFixed(2)} cm²</span>
                    </p>
                    <p>
                      Capacidad total mínima requerida: <span className="font-extrabold text-slate-800">{totalMinCap.toFixed(1)} L/s</span> | 
                      Proyectada: <span className="font-extrabold text-slate-800">{totalProjCap.toFixed(2)} L/s</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Extracción de Aire (Recintos Húmedos) */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Extracción de Aire (Recintos Húmedos)</h2>
              </div>

              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                5: Extracción local mecánica obligatoria en cocinas y baños
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Capacidad extractor cocina proyectado
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={extCocina}
                      min="0"
                      step="1"
                      onChange={(e) => setExtCocina(parseFloat(e.target.value) || 0)}
                      className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">m³/h</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Cerrada: 5 ACH o 50 L/s (campana) / 150 L/s (otros). Abierta: 50 L/s (campana) / 150 L/s (otros).
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Capacidad extractor baño proyectado
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={extBano}
                      min="0"
                      step="1"
                      onChange={(e) => setExtBano(parseFloat(e.target.value) || 0)}
                      className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">m³/h</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Control por demanda: 25 L/s | Continuo: 10 L/s.
                  </span>
                </div>
              </div>

              {/* Tipo de Extracción Baño Premium Card Toggles */}
              <div className="flex flex-col gap-2 mb-6">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tipo de Extracción Baño
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoBano('continuo')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col gap-1.5 cursor-pointer active:scale-98 ${
                      tipoBano === 'continuo'
                        ? 'border-emerald-700 bg-emerald-500/5 shadow-md shadow-emerald-500/5'
                        : 'border-slate-100 bg-slate-50/10 hover:border-slate-200 hover:bg-slate-50/30'
                    }`}
                  >
                    <span className={`text-xs font-black uppercase tracking-wider ${tipoBano === 'continuo' ? 'text-emerald-900' : 'text-slate-700'}`}>
                      Continuo (24 horas)
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium leading-relaxed">
                      Flujo de extracción continuo mínimo de 10 L/s por cada recinto de baño (Tabla 6).
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoBano('demanda')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col gap-1.5 cursor-pointer active:scale-98 ${
                      tipoBano === 'demanda'
                        ? 'border-emerald-700 bg-emerald-500/5 shadow-md shadow-emerald-500/5'
                        : 'border-slate-100 bg-slate-50/10 hover:border-slate-200 hover:bg-slate-50/30'
                    }`}
                  >
                    <span className={`text-xs font-black uppercase tracking-wider ${tipoBano === 'demanda' ? 'text-emerald-900' : 'text-slate-700'}`}>
                      Por Demanda (Intermitente)
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium leading-relaxed">
                      Flujo de extracción intermitente mínimo de 25 L/s por baño controlado por usuario (Tabla 5).
                    </span>
                  </button>
                </div>
              </div>

              {/* Wet Area Results Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs text-slate-800">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="px-4 py-3.5">Recinto</th>
                      <th className="px-4 py-3.5 text-center">Cant.</th>
                      <th className="px-4 py-3.5 text-right">Cap. req. (L/s)</th>
                      <th className="px-4 py-3.5 text-right">Cap. req. (m³/h)</th>
                      <th className="px-4 py-3.5 text-right">Cap. proj. (L/s)</th>
                      <th className="px-4 py-3.5 text-right">Cap. proj. (m³/h)</th>
                      <th className="px-4 py-3.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {/* Cocina */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-bold text-slate-700">Cocina ({tipoCocina})</td>
                      <td className="px-4 py-3.5 text-center">1</td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {tipoCocina === 'abierta' ? '0.00' : reqCocinaLs.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {tipoCocina === 'abierta' ? '0.0' : reqCocinaM3h.toFixed(1)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">{extCocinaLs.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right font-mono">{extCocina.toFixed(1)}</td>
                      <td className="px-4 py-3.5 text-center">
                        {tipoCocina === 'abierta' ? (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                            N/A
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            okCocina
                              ? 'bg-emerald-500/10 text-emerald-800'
                              : 'bg-rose-500/10 text-rose-800'
                          }`}>
                            {okCocina ? 'Cumple' : 'No Cumple'}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Baño */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-bold text-slate-700">Baño ({tipoBano})</td>
                      <td className="px-4 py-3.5 text-center">{banos}</td>
                      <td className="px-4 py-3.5 text-right font-mono">{reqBanoTotalLs.toFixed(1)}</td>
                      <td className="px-4 py-3.5 text-right font-mono">{reqBanoTotalM3h.toFixed(1)}</td>
                      <td className="px-4 py-3.5 text-right font-mono">{projBanoLs.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right font-mono">{projBanoM3h.toFixed(1)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          okBano
                            ? 'bg-emerald-500/10 text-emerald-800'
                            : 'bg-rose-500/10 text-rose-800'
                        }`}>
                          {okBano ? 'Cumple' : 'No Cumple'}
                        </span>
                      </td>
                    </tr>

                    {/* Totals row */}
                    <tr className="bg-emerald-500/5 font-extrabold text-emerald-800 border-t-2 border-emerald-500/20">
                      <td className="px-4 py-4">TOTAL</td>
                      <td className="px-4 py-4 text-center">-</td>
                      <td className="px-4 py-4 text-right font-mono">{totalReqLs.toFixed(1)}</td>
                      <td className="px-4 py-4 text-right font-mono">{totalReqM3h.toFixed(1)}</td>
                      <td className="px-4 py-4 text-right font-mono">{totalProjLs.toFixed(2)}</td>
                      <td className="px-4 py-4 text-right font-mono">{totalProjM3h.toFixed(1)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          cumpleExtraccion
                            ? 'bg-emerald-800 text-white'
                            : 'bg-rose-700 text-white'
                        }`}>
                          {cumpleExtraccion ? 'Cumple' : 'No Cumple'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Wet Area Dynamic Alert */}
              <div className={`mt-5 rounded-2xl border p-5 flex items-start gap-4 ${
                cumpleExtraccion
                  ? 'bg-emerald-500/5 border-emerald-500/25 text-slate-800'
                  : 'bg-rose-500/5 border-rose-500/25 text-slate-800'
              }`}>
                {cumpleExtraccion ? (
                  <CheckCircle2 className="text-emerald-700 mt-0.5 shrink-0" size={20} />
                ) : (
                  <XCircle className="text-rose-700 mt-0.5 shrink-0" size={20} />
                )}
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-wide ${cumpleExtraccion ? 'text-emerald-950' : 'text-rose-950'}`}>
                    {cumpleExtraccion ? 'EXTRACCION DE AIRE: CUMPLE' : 'EXTRACCION DE AIRE: NO CUMPLE'}
                  </h4>
                  <div className="text-xs mt-1.5 space-y-1 text-slate-600">
                    <p>
                      Capacidad total requerida: <span className="font-extrabold text-slate-800">{totalReqLs.toFixed(1)} L/s ({totalReqM3h.toFixed(1)} m³/h)</span>
                    </p>
                    <p>
                      Capacidad total proyectada: <span className="font-extrabold text-slate-800">{totalProjLs.toFixed(2)} L/s ({totalProjM3h.toFixed(1)} m³/h)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Profesional Responsable */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Profesional Responsable</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nombre Completo</label>
                  <input
                    type="text"
                    value={profNombre}
                    onChange={(e) => setProfNombre(e.target.value)}
                    placeholder="Nombre del proyectista"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">RUT</label>
                  <input
                    type="text"
                    value={profRut}
                    onChange={(e) => setProfRut(e.target.value)}
                    placeholder="12.345.678-9"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Título Profesional</label>
                  <input
                    type="text"
                    value={profTitulo}
                    onChange={(e) => setProfTitulo(e.target.value)}
                    placeholder="Ej: Ingeniero Civil, Constructor"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">N° Registro / Rol</label>
                  <input
                    type="text"
                    value={profRegistro}
                    onChange={(e) => setProfRegistro(e.target.value)}
                    placeholder="Número de registro"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-700/30 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 print:hidden">
              <button
                onClick={handleLimpiar}
                className="px-6 py-3.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 size={16} /> Limpiar Formulario
              </button>
              <button
                onClick={handlePrint}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-800 to-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-800/20 hover:shadow-xl hover:shadow-emerald-800/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={16} /> Generar Informe (PDF)
              </button>
            </div>
          </div>

          {/* Right Column: Sticky Flow Diagram & Safety Dashboard */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6 print:hidden">
            
            {/* Control Panel Card */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
              {/* Technical Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />

              <div className="relative z-10 space-y-5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-black text-emerald-400">Esquema Técnico</span>
                    <h3 className="text-sm font-bold text-slate-300">Flujo Dinámico de Aire</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-800 border border-slate-700/60 text-slate-300">
                    NCh 3309
                  </span>
                </div>

                {/* SVG Blueprint Wireframe */}
                <div className="border border-slate-800/80 bg-slate-950/60 rounded-2xl p-4 overflow-hidden flex items-center justify-center">
                  <svg viewBox="0 0 400 240" className="w-full h-auto text-slate-400 font-sans">
                    <defs>
                      <marker id="arrow-success" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                      </marker>
                      <marker id="arrow-danger" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
                      </marker>
                    </defs>

                    {/* House Outline */}
                    <rect x="110" y="100" width="180" height="95" rx="12" fill="none" stroke="#475569" strokeWidth="2.5" strokeDasharray="3 3" />
                    
                    {/* Roof */}
                    <path d="M 90,105 L 200,35 L 310,105" fill="none" stroke="#475569" strokeWidth="2.5" />
                    
                    {/* Foundation */}
                    <line x1="60" y1="195" x2="340" y2="195" stroke="#334155" strokeWidth="3" />

                    {/* INFLOW SIDE (Recintos Secos - Left) */}
                    <g>
                      <path d="M 35,125 L 95,125" fill="none" stroke={cumpleIngreso ? "#10b981" : "#f43f5e"} strokeWidth="2.5" markerEnd={cumpleIngreso ? "url(#arrow-success)" : "url(#arrow-danger)"} />
                      <path d="M 35,150 L 95,150" fill="none" stroke={cumpleIngreso ? "#10b981" : "#f43f5e"} strokeWidth="2.5" markerEnd={cumpleIngreso ? "url(#arrow-success)" : "url(#arrow-danger)"} />
                      
                      <text x="30" y="108" fill={cumpleIngreso ? "#34d399" : "#fb7185"} className="text-[10px] font-black tracking-wider">INGRESO (SECOS)</text>
                      <text x="30" y="172" fill="#94a3b8" className="text-[10px] font-mono font-bold">{totalProjCap.toFixed(1)} L/s proj.</text>
                      <text x="30" y="185" fill="#64748b" className="text-[9px] font-mono">req: {totalMinCap.toFixed(1)} L/s</text>
                    </g>

                    {/* OUTFLOW SIDE (Recintos Húmedos - Right) */}
                    <g>
                      <path d="M 305,125 L 365,125" fill="none" stroke={cumpleExtraccion ? "#10b981" : "#f43f5e"} strokeWidth="2.5" markerEnd={cumpleExtraccion ? "url(#arrow-success)" : "url(#arrow-danger)"} />
                      <path d="M 305,150 L 365,150" fill="none" stroke={cumpleExtraccion ? "#10b981" : "#f43f5e"} strokeWidth="2.5" markerEnd={cumpleExtraccion ? "url(#arrow-success)" : "url(#arrow-danger)"} />
                      
                      <text x="370" y="108" fill={cumpleExtraccion ? "#34d399" : "#fb7185"} className="text-[10px] font-black tracking-wider" textAnchor="end">EXTRACCIÓN (HÚMEDOS)</text>
                      <text x="370" y="172" fill="#94a3b8" className="text-[10px] font-mono font-bold" textAnchor="end">{totalProjLs.toFixed(1)} L/s proj.</text>
                      <text x="370" y="185" fill="#64748b" className="text-[9px] font-mono" textAnchor="end">req: {totalReqLs.toFixed(1)} L/s</text>
                    </g>

                    {/* CENTER / TOTAL REQUIREMENT */}
                    <g>
                      <rect x="135" y="70" width="130" height="50" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                      <text x="200" y="88" fill="#e2e8f0" className="text-[10px] font-black" textAnchor="middle">Qtot REQUERIDO</text>
                      <text x="200" y="108" fill="#34d399" className="text-sm font-black tracking-tight" textAnchor="middle">{qTotal.toFixed(1)} L/s</text>

                      {/* Dwelling description */}
                      <text x="200" y="150" fill="#94a3b8" className="text-[9px] font-semibold" textAnchor="middle">{superficie} m² | {dormitorios} Dorm. | {banos} {banos === 1 ? 'Baño' : 'Baños'}</text>
                      <text x="200" y="165" fill="#64748b" className="text-[8px] font-mono" textAnchor="middle">Cocina {tipoCocina === 'cerrada' ? 'Cerrada' : 'Abierta'} ({volCocina} m³)</text>
                    </g>
                  </svg>
                </div>

                {/* Checklist validation */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Verificaciones de Seguridad</h4>
                  
                  {/* Item 1: Qtot */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <div className="text-xs">
                        <p className="font-extrabold text-slate-200">Tasa de Renovación Mínima</p>
                        <p className="text-[10px] text-slate-500">Caudal Qtot = {qTotal.toFixed(1)} L/s calculado</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-bold uppercase">Activa</span>
                  </div>

                  {/* Item 2: Ingreso */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      {cumpleIngreso ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <XCircle size={16} className="text-rose-500" />
                      )}
                      <div className="text-xs">
                        <p className="font-extrabold text-slate-200">Ingreso Recintos Secos</p>
                        <p className="text-[10px] text-slate-500">Abertura util y capacidad</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border ${
                      cumpleIngreso
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {cumpleIngreso ? 'Cumple' : 'Revisar'}
                    </span>
                  </div>

                  {/* Item 3: Extracción */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      {cumpleExtraccion ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <XCircle size={16} className="text-rose-500" />
                      )}
                      <div className="text-xs">
                        <p className="font-extrabold text-slate-200">Extracción Recintos Húmedos</p>
                        <p className="text-[10px] text-slate-500">Extractores en baño y cocina</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border ${
                      cumpleExtraccion
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {cumpleExtraccion ? 'Cumple' : 'Revisar'}
                    </span>
                  </div>

                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* ===================== TAB: TABLAS ===================== */}
      {activeTab === 'tablas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-800 font-extrabold text-xs">T1b</span>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Tabla 1b - Requisitos de Ventilación (L/s)</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">NCh3309 4.1.1 - Tasa de ventilación total necesaria Qtot</p>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full border-collapse text-left text-xs text-slate-800 font-medium">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="px-4 py-3">Superficie suelo (m²)</th>
                    <th className="px-4 py-3 text-right">1 Dorm.</th>
                    <th className="px-4 py-3 text-right">2 Dorm.</th>
                    <th className="px-4 py-3 text-right">3 Dorm.</th>
                    <th className="px-4 py-3 text-right">4 Dorm.</th>
                    <th className="px-4 py-3 text-right">5 Dorm.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr><td className="px-4 py-2.5 font-sans font-bold text-slate-600">&lt; 47</td><td className="px-4 py-2.5 text-right">14</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">18</td><td className="px-4 py-2.5 text-right">21</td><td className="px-4 py-2.5 text-right">25</td><td className="px-4 py-2.5 text-right">28</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-2.5 font-sans font-bold text-slate-600">47 - 93</td><td className="px-4 py-2.5 text-right">21</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">24</td><td className="px-4 py-2.5 text-right">28</td><td className="px-4 py-2.5 text-right">31</td><td className="px-4 py-2.5 text-right">35</td></tr>
                  <tr><td className="px-4 py-2.5 font-sans font-bold text-slate-600">94 - 139</td><td className="px-4 py-2.5 text-right">28</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">31</td><td className="px-4 py-2.5 text-right">35</td><td className="px-4 py-2.5 text-right">38</td><td className="px-4 py-2.5 text-right">42</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-2.5 font-sans font-bold text-slate-600">140 - 186</td><td className="px-4 py-2.5 text-right">35</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">38</td><td className="px-4 py-2.5 text-right">42</td><td className="px-4 py-2.5 text-right">45</td><td className="px-4 py-2.5 text-right">49</td></tr>
                  <tr><td className="px-4 py-2.5 font-sans font-bold text-slate-600">187 - 232</td><td className="px-4 py-2.5 text-right">42</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">45</td><td className="px-4 py-2.5 text-right">49</td><td className="px-4 py-2.5 text-right">52</td><td className="px-4 py-2.5 text-right">56</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-2.5 font-sans font-bold text-slate-600">233 - 279</td><td className="px-4 py-2.5 text-right">49</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">52</td><td className="px-4 py-2.5 text-right">56</td><td className="px-4 py-2.5 text-right">59</td><td className="px-4 py-2.5 text-right">63</td></tr>
                  <tr><td className="px-4 py-2.5 font-sans font-bold text-slate-600">280 - 325</td><td className="px-4 py-2.5 text-right">56</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">59</td><td className="px-4 py-2.5 text-right">63</td><td className="px-4 py-2.5 text-right">66</td><td className="px-4 py-2.5 text-right">70</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-2.5 font-sans font-bold text-slate-600">326 - 372</td><td className="px-4 py-2.5 text-right">63</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">66</td><td className="px-4 py-2.5 text-right">70</td><td className="px-4 py-2.5 text-right">73</td><td className="px-4 py-2.5 text-right">77</td></tr>
                  <tr><td className="px-4 py-2.5 font-sans font-bold text-slate-600">373 - 418</td><td className="px-4 py-2.5 text-right">70</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">73</td><td className="px-4 py-2.5 text-right">77</td><td className="px-4 py-2.5 text-right">80</td><td className="px-4 py-2.5 text-right">84</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-2.5 font-sans font-bold text-slate-600">419 - 465</td><td className="px-4 py-2.5 text-right">77</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">80</td><td className="px-4 py-2.5 text-right">84</td><td className="px-4 py-2.5 text-right">87</td><td className="px-4 py-2.5 text-right">91</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-800 font-extrabold text-xs">T5</span>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Tabla 5 - Extracción Local por Demanda</h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs text-slate-800 font-medium">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="px-4 py-3">Aplicación</th>
                      <th className="px-4 py-3 text-right">Flujo de aire mínimo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="px-4 py-2.5 text-slate-700">Cocina cerrada - Campana</td><td className="px-4 py-2.5 text-right font-mono">50 L/s (100 cfm)</td></tr>
                    <tr className="bg-slate-50/50"><td className="px-4 py-2.5 text-slate-700">Cocina cerrada - Otros</td><td className="px-4 py-2.5 text-right font-mono">150 L/s o 5 ACH</td></tr>
                    <tr><td className="px-4 py-2.5 text-slate-700">Cocina abierta - Campana</td><td className="px-4 py-2.5 text-right font-mono">50 L/s (100 cfm)</td></tr>
                    <tr className="bg-slate-50/50"><td className="px-4 py-2.5 text-slate-700">Cocina abierta - Otros</td><td className="px-4 py-2.5 text-right font-mono">150 L/s (300 cfm)</td></tr>
                    <tr><td className="px-4 py-2.5 text-slate-700">Baño</td><td className="px-4 py-2.5 text-right font-mono">25 L/s (50 cfm)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-800 font-extrabold text-xs">T6</span>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Tabla 6 - Extracción Local Continua</h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs text-slate-800 font-medium">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="px-4 py-3">Aplicación</th>
                      <th className="px-4 py-3 text-right">Flujo de aire mínimo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="px-4 py-2.5 text-slate-700">Cocina cerrada</td><td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-800">5 ACH (Volumen cocina)</td></tr>
                    <tr className="bg-slate-50/50"><td className="px-4 py-2.5 text-slate-700">Cocina abierta</td><td className="px-4 py-2.5 text-right font-mono text-slate-400">No aplica (usar Demanda)</td></tr>
                    <tr><td className="px-4 py-2.5 text-slate-700">Baño</td><td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-800">10 L/s (20 cfm)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-800 font-extrabold text-xs">T7</span>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Tabla 7 - Tamaño Prescriptivo de Conductos</h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs text-slate-800 font-medium">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="px-4 py-3">Capacidad (L/s)</th>
                      <th className="px-4 py-3 text-right">&lt;= 25</th>
                      <th className="px-4 py-3 text-right">&lt;= 40</th>
                      <th className="px-4 py-3 text-right">&lt;= 50</th>
                      <th className="px-4 py-3 text-right">&lt;= 60</th>
                      <th className="px-4 py-3 text-right">&lt;= 70</th>
                      <th className="px-4 py-3 text-right">&lt;= 85</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr><td className="px-4 py-2.5 font-sans font-bold text-slate-600">Rígido Ø (mm)</td><td className="px-4 py-2.5 text-right">100</td><td className="px-4 py-2.5 text-right">125</td><td className="px-4 py-2.5 text-right">125</td><td className="px-4 py-2.5 text-right">150</td><td className="px-4 py-2.5 text-right">150</td><td className="px-4 py-2.5 text-right">180</td></tr>
                    <tr className="bg-slate-50/50"><td className="px-4 py-2.5 font-sans font-bold text-slate-600">Flexible Ø (mm)</td><td className="px-4 py-2.5 text-right">100</td><td className="px-4 py-2.5 text-right">125</td><td className="px-4 py-2.5 text-right">150</td><td className="px-4 py-2.5 text-right">150</td><td className="px-4 py-2.5 text-right">150</td><td className="px-4 py-2.5 text-right">180</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-semibold">
                A 62,5 Pa (0,25" H₂O) mínimo. Máx. 8m longitud, máx. 3 codos (5.4).
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-800 font-extrabold text-xs">T8/9</span>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Tabla 8 y 9 - Niveles de Presión Sonora</h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs text-slate-800 font-medium">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="px-4 py-3">Tipo de Extractor</th>
                      <th className="px-4 py-3 text-right">Nivel dB(A)</th>
                      <th className="px-4 py-3 text-right">Distancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="px-4 py-2.5 text-slate-700">Ventiladores continuos (Tabla 8)</td><td className="px-4 py-2.5 text-right font-mono">35</td><td className="px-4 py-2.5 text-right font-mono">1.5 m</td></tr>
                    <tr className="bg-slate-50/50"><td className="px-4 py-2.5 text-slate-700">Ventiladores continuos (Tabla 8)</td><td className="px-4 py-2.5 text-right font-mono">29</td><td className="px-4 py-2.5 text-right font-mono">3.0 m</td></tr>
                    <tr><td className="px-4 py-2.5 text-slate-700">Extractores por demanda (Tabla 9)</td><td className="px-4 py-2.5 text-right font-mono">45</td><td className="px-4 py-2.5 text-right font-mono">1.5 m</td></tr>
                    <tr className="bg-slate-50/50"><td className="px-4 py-2.5 text-slate-700">Extractores por demanda (Tabla 9)</td><td className="px-4 py-2.5 text-right font-mono">39</td><td className="px-4 py-2.5 text-right font-mono">3.0 m</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-semibold">
                7.2 - Ventiladores con flujo &gt; 189 L/s (400 cfm) exentos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB: NORMA ===================== */}
      {activeTab === 'norma' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <Shield className="text-emerald-800" size={24} />
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Resumen NCh 3309:2022 / 2014</h2>
            </div>

            <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 text-slate-700 space-y-2">
              <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider">Alcance (1)</h3>
              <p className="text-xs leading-relaxed">
                Aplica a unidades de vivienda en ocupaciones residenciales donde los ocupantes no son transitorios (&gt;30 días). 
                Considera contaminantes químicos, físicos y biológicos.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-4">
                <h4 className="text-sm font-black text-emerald-850 mb-2">4. Ventilación de la Unidad de Vivienda</h4>
                <ul className="list-disc list-inside text-xs text-slate-650 space-y-1.5 pl-2 leading-relaxed">
                  <li><strong>Tasa de ventilación:</strong> Sistema de extracción, inyección o combinación (al menos uno mecánico).</li>
                  <li><strong>Fórmula:</strong> Qtot = 0,15 × Afloor + 3,5 × (Nbr + 1) [L/s]</li>
                  <li><strong>Densidad de ocupantes:</strong> +3,5 L/s por cada persona adicional a la presunta (2 en principal, 1 por dormitorio adicional).</li>
                  <li><strong>Crédito infiltración:</strong> Hasta 0,2 × Qtot si se usa filtro MERV 11+ con distribución a todas las habitaciones.</li>
                </ul>
              </div>

              <div className="border-b border-slate-100 pb-4">
                <h4 className="text-sm font-black text-emerald-850 mb-2">5. Extracción Local</h4>
                <ul className="list-disc list-inside text-xs text-slate-650 space-y-1.5 pl-2 leading-relaxed">
                  <li><strong>Obligatoriedad:</strong> Sistema mecánico local obligatorio en cada cocina y baño.</li>
                  <li><strong>Por demanda:</strong> Control automático o manual ON/OFF. Cocina: 50-150 L/s | Baño: 25 L/s.</li>
                  <li><strong>Continuo:</strong> Funcionamiento continuo 24h. Cocina cerrada: 5 ACH | Baño: 10 L/s.</li>
                </ul>
              </div>

              <div className="border-b border-slate-100 pb-4">
                <h4 className="text-sm font-black text-emerald-850 mb-2">6. Otros Requisitos</h4>
                <ul className="list-disc list-inside text-xs text-slate-650 space-y-1.5 pl-2 leading-relaxed">
                  <li><strong>Hermeticidad:</strong> &lt;= 150 L/s por 100m² a 50 Pa (test de presurización NCh3295).</li>
                  <li><strong>Aberturas:</strong> Espacios habitables &gt;= 4% del área del suelo o 0,5m². Inodoros &gt;= 4% o 0,15m².</li>
                  <li><strong>Filtración:</strong> MERV 6 mínimo en sistemas con conductos &gt; 3m.</li>
                  <li><strong>Entradas de aire:</strong> Mínimo a 3m de fuentes de contaminación conocidas.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-black text-emerald-850 mb-2">7. Equipos y Conductos</h4>
                <ul className="list-disc list-inside text-xs text-slate-650 space-y-1.5 pl-2 leading-relaxed">
                  <li><strong>Sonido:</strong> Ventilación continua &lt;= 35 dB(A) a 1,5m. Extractores por demanda &lt;= 45 dB(A) a 1,5m.</li>
                  <li><strong>Conductos:</strong> No compartir entre diferentes unidades de vivienda.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB: INFO ===================== */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <Info className="text-emerald-800" size={22} />
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Acerca de esta Aplicación</h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta aplicación calcula los requisitos de ventilación para viviendas residenciales según la <strong>Norma Chilena NCh3309</strong> (edición 2022, compatible con 2014).
              </p>
              <div className="text-xs text-slate-700 space-y-2 pt-2">
                <h4 className="font-bold text-slate-800">Funcionalidades clave:</h4>
                <ul className="list-disc list-inside pl-2 space-y-1 text-slate-650">
                  <li>Cálculo automático de caudal total requerido (Qtot).</li>
                  <li>Verificación de ingreso de aire en recintos secos.</li>
                  <li>Verificación de extracción en recintos húmedos.</li>
                  <li>Tablas e informe en PDF optimizado para impresión.</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <Layers className="text-emerald-800" size={22} />
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Instalación PWA</h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta aplicación funciona sin conexión a internet una vez cargada en el navegador web del dispositivo móvil u ordenador.
              </p>
              <div className="text-xs text-slate-700 space-y-2 pt-2">
                <p><strong>iOS (Safari):</strong> Compartir &rarr; "Agregar a pantalla de inicio"</p>
                <p><strong>Android (Chrome):</strong> Menú &rarr; "Instalar aplicación"</p>
                <p><strong>Windows (Chrome/Edge):</strong> Menú &rarr; "Instalar calculadora..."</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUMMARY BAR (Sticky Footer) ===================== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-4 flex items-center justify-between shadow-2xl z-40 max-w-5xl mx-auto rounded-t-3xl print:hidden">
        <div className="flex items-center gap-6 sm:gap-10">
          <div className="text-center sm:text-left">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Caudal Total</div>
            <div className="text-base sm:text-lg font-black text-emerald-800">{qTotal.toFixed(1)} L/s</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-center sm:text-left">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ingreso</div>
            <div className={`text-xs sm:text-sm font-black flex items-center gap-1.5 justify-center sm:justify-start ${cumpleIngreso ? 'text-emerald-800' : 'text-rose-800'}`}>
              {cumpleIngreso ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {cumpleIngreso ? 'OK' : 'FALTA'}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-center sm:text-left">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extracción</div>
            <div className={`text-xs sm:text-sm font-black flex items-center gap-1.5 justify-center sm:justify-start ${cumpleExtraccion ? 'text-emerald-800' : 'text-rose-800'}`}>
              {cumpleExtraccion ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {cumpleExtraccion ? 'OK' : 'FALTA'}
            </div>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-black tracking-wide flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-850/10 active:scale-95 transition-all"
        >
          <Printer size={13} /> IMPRIMIR REPORT
        </button>
      </div>

      {/* Spacer for sticky bar */}
      <div className="h-24 print:hidden" />
    </div>
  );
}
