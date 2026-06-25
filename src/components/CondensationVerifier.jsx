import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, 
  CloudSun, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Plus, 
  Search, 
  Printer, 
  Download, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  X
} from 'lucide-react';
import { BIBLIOTECA, DATOS_CLIMA, PZ, RSI, RSE, delta0, REGIONES_CHILE, COMUNAS_CON_ALTITUD, U_MAX_OGUC, ELEM_TYPES } from '../lib/condConstants';
import { pSat, Tdew, calcCase, matR, matSd, matMuDisp } from '../lib/condPhysics';
import InputGroup from './InputGroup';

export default function CondensationVerifier({ sharedProject, setSharedProject }) {
  // Wizard steps
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    { title: 'Proyecto', icon: Building, desc: 'Información general' },
    { title: 'Clima', icon: CloudSun, desc: 'Condiciones de cálculo' },
    { title: 'Capas', icon: Layers, desc: 'Configuración constructiva' },
    { title: 'Resultados', icon: CheckCircle2, desc: 'Gráficos y Conclusión' }
  ];

  // Step 0: Project State
  const [projectInfo, setProjectInfo] = useState({
    owner: sharedProject.owner,
    prof: sharedProject.prof,
    address: sharedProject.address,
    commune: sharedProject.commune || 'Santiago',
    rut: sharedProject.rut,
    fecha: sharedProject.fecha,
    pda: '',
    descBase: 'Muro de albañilería existente',
    descProj: 'Muro con aislación térmica EIFS',
    elemType: 'muro', // muro | techo | piso
    mobiliario: '2' // Rsi + 0.02
  });

  // Step 1: Climate State (3-level selector: Region -> Provincia -> Comuna)
  const [climate, setClimate] = useState({
    region: 'Región Metropolitana de Santiago',
    provincia: 'Provincia de Santiago',
    comuna: sharedProject.commune || 'Santiago',
    altitud: 'bajo' // 'bajo' (<1000m) o 'alto' (>=1000m)
  });

  const hasAltitudeOption = useMemo(() => {
    return COMUNAS_CON_ALTITUD.includes(climate.comuna);
  }, [climate.comuna]);

  useEffect(() => {
    if (!setSharedProject) return;
    setSharedProject(prev => {
      if (
        prev.owner === projectInfo.owner &&
        prev.prof === projectInfo.prof &&
        prev.address === projectInfo.address &&
        prev.commune === projectInfo.commune &&
        prev.rut === projectInfo.rut &&
        prev.fecha === projectInfo.fecha
      ) {
        return prev;
      }
      return {
        ...prev,
        owner: projectInfo.owner,
        prof: projectInfo.prof,
        address: projectInfo.address,
        commune: projectInfo.commune,
        rut: projectInfo.rut,
        fecha: projectInfo.fecha
      };
    });
  }, [projectInfo.owner, projectInfo.prof, projectInfo.address, projectInfo.commune, projectInfo.rut, projectInfo.fecha, setSharedProject]);

  useEffect(() => {
    if (!hasAltitudeOption && climate.altitud !== 'bajo') {
      setClimate(prev => ({ ...prev, altitud: 'bajo' }));
    }
  }, [climate.comuna, hasAltitudeOption, climate.altitud]);

  const activeZonaTermica = useMemo(() => {
    if (climate.altitud === 'alto') {
      return 'H'; // Precordillera de gran altitud se asocia a Zona H
    }
    for (const [zona, provincias] of Object.entries(PZ)) {
      if (provincias.includes(climate.provincia)) {
        return zona;
      }
    }
    return 'D';
  }, [climate.provincia, climate.altitud]);

  const activeWeatherData = useMemo(() => {
    const baseWeather = DATOS_CLIMA[climate.provincia] || { te: 2.2, hre: 0.92 };
    if (climate.altitud === 'alto') {
      // Disminución de temperatura por gradiente altotérmico de montaña (típicamente -4.0°C)
      return {
        te: Math.round((baseWeather.te - 4.0) * 10) / 10,
        hre: Math.min(1.0, baseWeather.hre + 0.03)
      };
    }
    return baseWeather;
  }, [climate.provincia, climate.altitud]);

  const activeElemType = useMemo(() => {
    return ELEM_TYPES.find(e => e.id === projectInfo.elemType) || ELEM_TYPES[0];
  }, [projectInfo.elemType]);

  const activeRsi = useMemo(() => {
    const baseRsi = RSI[activeElemType.rsiKey] || 0.13;
    return baseRsi + (projectInfo.mobiliario === '2' ? 0.02 : 0);
  }, [activeElemType, projectInfo.mobiliario]);

  // User Defined Materials State
  const [userMats, setUserMats] = useState([]);
  
  // Custom Material Form State
  const [customMatForm, setCustomMatForm] = useState({
    n: '',
    lam: '',
    e: '0.02',
    tipo: 'mu',
    val: ''
  });

  const convertedMuValue = useMemo(() => {
    const val = parseFloat(customMatForm.val);
    const e = parseFloat(customMatForm.e) || 0.02;
    if (isNaN(val) || val <= 0) return null;

    let mu = null;
    if (customMatForm.tipo === 'mu') {
      mu = val;
    } else if (customMatForm.tipo === 'sd') {
      mu = val / e;
    } else if (customMatForm.tipo === 'dp_gm') {
      const dp_kg = val * 1e-9;
      mu = delta0 / dp_kg;
    } else if (customMatForm.tipo === 'dp_kg') {
      mu = delta0 / val;
    } else if (customMatForm.tipo === 'wp') {
      mu = delta0 / (val * e);
    } else if (customMatForm.tipo === 'zp_mn') {
      const zp_msPaKg = val * 1e-9; // MNs/g a msPa/kg equiv.
      const dp_kg = e / (val * 1e9);
      mu = delta0 / dp_kg;
    }
    return mu;
  }, [customMatForm.val, customMatForm.tipo, customMatForm.e]);

  // Combine Library + User Materials
  const allMaterials = useMemo(() => {
    return [...BIBLIOTECA, ...userMats];
  }, [userMats]);

  // Step 2: Layers State
  const [layersBase, setLayersBase] = useState([
    { mi: 15, e: 0.006 }, // Fibrocemento 1250 kg/m³
    { mi: 7, e: 0.05 },    // EPS 15 kg/m³
    { mi: 59, e: 0.0125 }  // Yeso cartón RF 840 kg/m³
  ]);

  const [layersProj, setLayersProj] = useState([
    { mi: 15, e: 0.006 },
    { mi: 7, e: 0.08 },
    { mi: 11, e: 0.0111 }, // Espuma niveladora
    { mi: 59, e: 0.0125 }
  ]);

  const [activeCaseTab, setActiveCaseTab] = useState('base'); // base, proj, bib

  // Library Modal Search and Filters
  const [isBibModalOpen, setIsBibModalOpen] = useState(false);
  const [bibTarget, setBibTarget] = useState('base'); // base or proj
  const [bibSearch, setBibSearch] = useState('');
  const [bibFilterG, setBibFilterG] = useState('');

  const getMaterialCategory = (m) => {
    const name = m.n.toLowerCase();
    const group = (m.g || '').toLowerCase();
    
    if (name.includes('lana') || name.includes('eps') || name.includes('celulosa') || name.includes('corcho aglomerado') || name.includes('poliuretano') || name.includes('aislante') || name.includes('elastomérica')) {
      return 'Aislantes';
    }
    if (name.includes('pintura') || name.includes('barniz') || name.includes('adhesivo eifs') || name.includes('impregnante') || name.includes('adhesivo')) {
      return 'Pinturas y Adhesivos';
    }
    if (name.includes('yeso') || name.includes('volcán') || name.includes('placa') || name.includes('mdf') || name.includes('osb') || name.includes('terciado') || name.includes('contrachapada') || name.includes('panel') || name.includes('smartpanel')) {
      return 'Placas y Paneles';
    }
    if (name.includes('estuco') || name.includes('mortero') || name.includes('revoque') || name.includes('enlucido')) {
      return 'Morteros y Estucos';
    }
    if (name.includes('hormigón') || name.includes('ladrillo') || name.includes('cemento arena')) {
      return 'Hormigón y Albañilería';
    }
    if (name.includes('fieltro') || name.includes('polietileno') || name.includes('klober') || name.includes('tyvek') || name.includes('typar') || name.includes('wrap') || name.includes('membrana') || name.includes('impermeabilizante') || name.includes('bitumen fieltro')) {
      return 'Barreras y Fieltros';
    }
    if (group.includes('metales') || name.includes('aluminio') || name.includes('acero') || name.includes('cobre') || name.includes('zinc') || name.includes('plomo') || name.includes('bronce') || name.includes('latón') || name.includes('hierro')) {
      return 'Metales';
    }
    if (group.includes('plásticos') || group.includes('caucho') || name.includes('acrílico') || name.includes('policarbonato') || name.includes('pvc') || name.includes('ptfe') || name.includes('silic') || name.includes('epóx') || name.includes('caucho') || name.includes('neopreno') || name.includes('epdm') || name.includes('piso') || name.includes('alfombra') || name.includes('linóleo')) {
      return 'Plásticos y Gomas';
    }
    if (group.includes('rocas') || group.includes('suelos') || group.includes('vidrio') || name.includes('roca') || name.includes('suelo') || name.includes('arcilla') || name.includes('arena') || name.includes('grava') || name.includes('vidrio') || name.includes('mosaico') || name.includes('caliza') || name.includes('granito') || name.includes('basalto') || name.includes('mármol')) {
      return 'Rocas, Suelos y Vidrio';
    }
    
    if (m.barrera) return 'Barreras y Fieltros';
    return 'Otros';
  };

  const getCategoryStyles = (g, isActive) => {
    switch (g) {
      case 'Aislantes':
        return isActive 
          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' 
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50';
      case 'Placas y Paneles':
        return isActive 
          ? 'bg-amber-600 text-white border-amber-500 shadow-sm' 
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/50';
      case 'Morteros y Estucos':
        return isActive 
          ? 'bg-rose-600 text-white border-rose-500 shadow-sm' 
          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50';
      case 'Hormigón y Albañilería':
        return isActive 
          ? 'bg-slate-600 text-white border-slate-500 shadow-sm' 
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300/50';
      case 'Barreras y Fieltros':
        return isActive 
          ? 'bg-sky-600 text-white border-sky-500 shadow-sm' 
          : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/50';
      case 'Metales':
        return isActive 
          ? 'bg-blue-600 text-white border-blue-500 shadow-sm' 
          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/50';
      case 'Plásticos y Gomas':
        return isActive 
          ? 'bg-teal-600 text-white border-teal-500 shadow-sm' 
          : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/50';
      case 'Rocas, Suelos y Vidrio':
        return isActive 
          ? 'bg-purple-600 text-white border-purple-500 shadow-sm' 
          : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/50';
      case 'Pinturas y Adhesivos':
        return isActive 
          ? 'bg-pink-600 text-white border-pink-500 shadow-sm' 
          : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/50';
      case 'Otros':
        return isActive 
          ? 'bg-fuchsia-600 text-white border-fuchsia-500 shadow-sm' 
          : 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 border border-fuchsia-200/50';
      default:
        return isActive 
          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' 
          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200';
    }
  };

  const libraryGroups = useMemo(() => {
    return [
      'Aislantes',
      'Placas y Paneles',
      'Morteros y Estucos',
      'Hormigón y Albañilería',
      'Barreras y Fieltros',
      'Metales',
      'Plásticos y Gomas',
      'Rocas, Suelos y Vidrio',
      'Pinturas y Adhesivos',
      'Otros'
    ];
  }, []);

  const filteredMaterials = useMemo(() => {
    const q = bibSearch.toLowerCase();
    return allMaterials
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => {
        const cat = getMaterialCategory(m);
        const gOk = !bibFilterG || cat === bibFilterG;
        const qOk = !q || m.n.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || (m.g || '').toLowerCase().includes(q);
        return gOk && qOk;
      });
  }, [allMaterials, bibSearch, bibFilterG]);

  // Calculations Results
  const HRi_list = useMemo(() => [0.65, 0.75, 0.80], []);

  const results = useMemo(() => {
    const getMat = (idx) => allMaterials[idx];
    const Te = activeWeatherData.te;
    const HRe = activeWeatherData.hre;
    const Ti = 19; // NCh1973 fixed indoor temp

    const base = calcCase({
      layers: layersBase,
      Te,
      HRe,
      Ti,
      HRi_list,
      Rsi: activeRsi,
      getMat
    });

    const proj = calcCase({
      layers: layersProj,
      Te,
      HRe,
      Ti,
      HRi_list,
      Rsi: activeRsi,
      getMat
    });

    return { base, proj };
  }, [layersBase, layersProj, activeWeatherData, activeRsi, allMaterials, HRi_list]);

  // Exigencia térmica OGUC
  const ogucCheck = useMemo(() => {
    const zona = activeZonaTermica;
    const elemKey = activeElemType.id;
    const uMax = U_MAX_OGUC[zona]?.[elemKey] ?? null;
    const uBase = results ? 1 / results.base.RT : null;
    const uProj = results ? 1 / results.proj.RT : null;
    return {
      uMax,
      uBase,
      uProj,
      cumpleBase: uMax != null && uBase != null ? uBase <= uMax : null,
      cumpleProj: uMax != null && uProj != null ? uProj <= uMax : null,
    };
  }, [activeZonaTermica, activeElemType, results]);

  // Step 3: Results Sub-tabs
  const [activeResultTab, setActiveResultTab] = useState('sup'); // sup, int, graf, conc

  // Graphic Chart Canvas rendering
  const tempCanvasRef = useRef(null);
  const pressCanvasRef = useRef(null);
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(600);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const handleResize = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeResultTab]);

  useEffect(() => {
    if (results.base && results.proj) {
      drawTChart();
      drawPChart();
    }
  }, [results, chartWidth]);

  const drawTChart = () => {
    const cv = tempCanvasRef.current;
    if (!cv) return;
    const H = 210;
    const dpr = window.devicePixelRatio || 1;
    
    // Fallback if chartWidth is not computed or 0 (e.g. hidden tab)
    const activeWidth = chartWidth > 150 ? chartWidth : 600;
    
    // Set display size and scale canvas internal resolution
    cv.width = activeWidth * dpr;
    cv.height = H * dpr;
    
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, activeWidth, H);

    // Render light slate-white background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, activeWidth, H);

    const B = results.base;
    const P = results.proj;
    const pad = { l: 50, r: 20, t: 20, b: 30 };
    const pw = activeWidth - pad.l - pad.r;
    const ph = H - pad.t - pad.b;

    const allT = [
      ...B.pts.map(pt => pt.T),
      ...P.pts.map(pt => pt.T),
      19,
      activeWeatherData.te,
      ...[0.65, 0.75, 0.80].map(phi => Tdew(19, phi))
    ];
    const mn = Math.min(...allT) - 1.5;
    const mx = Math.max(...allT) + 1.5;

    const xp = (i, n) => pad.l + (i / (n - 1)) * pw;
    const yp = (T) => pad.t + ph - ((T - mn) / (mx - mn)) * ph;

    // Grid lines and Y axis in light slate
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = yp(mn + g * (mx - mn) / 4);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();

      const T = mn + g * (mx - mn) / 4;
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(T.toFixed(0) + '°C', pad.l - 8, y + 3);
    }

    // Dew point lines
    [0.65, 0.75, 0.80].forEach((phi, idx) => {
      const Td = Tdew(19, phi);
      const cols = ['rgba(217, 119, 6, 0.95)', 'rgba(225, 29, 72, 0.95)', 'rgba(220, 38, 38, 0.95)'];
      const y = yp(Td);
      ctx.strokeStyle = cols[idx];
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = cols[idx];
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Td ${Math.round(phi * 100)}% = ${Td.toFixed(1)}°C`, pad.l + 8, y - 4);
    });

    // Base solution plot (Blue)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    B.pts.forEach((pt, i) => {
      const x = xp(i, B.pts.length);
      const y = yp(pt.T);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Node circles for Base case (with high-contrast white outline)
    B.pts.forEach((pt, i) => {
      const x = xp(i, B.pts.length);
      const y = yp(pt.T);
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Projected solution plot (Green)
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.beginPath();
    P.pts.forEach((pt, i) => {
      const x = xp(i, P.pts.length);
      const y = yp(pt.T);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Node circles for Projected case (with high-contrast white outline)
    P.pts.forEach((pt, i) => {
      const x = xp(i, P.pts.length);
      const y = yp(pt.T);
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Axis labels
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('◀ EXTERIOR', pad.l + 4, H - 8);
    ctx.textAlign = 'right';
    ctx.fillText('INTERIOR ▶', pad.l + pw - 4, H - 8);
  };

  const drawPChart = () => {
    const cv = pressCanvasRef.current;
    if (!cv) return;
    const H = 210;
    const dpr = window.devicePixelRatio || 1;
    
    // Fallback if chartWidth is not computed or 0 (e.g. hidden tab)
    const activeWidth = chartWidth > 150 ? chartWidth : 600;
    
    cv.width = activeWidth * dpr;
    cv.height = H * dpr;
    
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, activeWidth, H);

    // Solid light slate-white background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, activeWidth, H);

    const B = results.base;
    const P = results.proj;
    const pad = { l: 55, r: 20, t: 20, b: 30 };
    const pw = activeWidth - pad.l - pad.r;
    const ph = H - pad.t - pad.b;

    const Pe = activeWeatherData.hre * pSat(activeWeatherData.te);
    const pvArr = (pts, phi) => {
      const Pi = phi * pSat(19);
      const SdT = pts[pts.length - 1].Sd_acum || 1;
      return pts.map(pt => Pe + (Pi - Pe) * pt.Sd_acum / SdT);
    };

    const bPsat = B.pts.map(pt => pSat(pt.T));
    const pPsat = P.pts.map(pt => pSat(pt.T));
    const allP = [...bPsat, ...pPsat, ...pvArr(B.pts, 0.8), Pe, pSat(19)];
    const mn = 0;
    const mx = Math.max(...allP) * 1.05;

    const xp = (i, n) => pad.l + (i / (n - 1)) * pw;
    const yp = (Pv) => pad.t + ph - ((Pv - mn) / (mx - mn)) * ph;

    // Grid lines and Y axis
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = yp(mn + g * (mx - mn) / 4);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();

      const PVal = mn + g * (mx - mn) / 4;
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(PVal) + ' Pa', pad.l - 8, y + 3);
    }

    // Psat Base (Blue)
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    bPsat.forEach((v, i) => {
      const x = xp(i, B.pts.length);
      const y = yp(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Node circles for Psat Base (with high-contrast white outline)
    bPsat.forEach((v, i) => {
      const x = xp(i, B.pts.length);
      const y = yp(v);
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Psat Proyectado (Green)
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pPsat.forEach((v, i) => {
      const x = xp(i, P.pts.length);
      const y = yp(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Node circles for Psat Proyectado (with high-contrast white outline)
    pPsat.forEach((v, i) => {
      const x = xp(i, P.pts.length);
      const y = yp(v);
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Vapor pressure profiles at HR 65%, 75%, 80% (dotted warm colors)
    [[0.65, 'rgba(217, 119, 6, 0.95)'], [0.75, 'rgba(225, 29, 72, 0.95)'], [0.80, 'rgba(220, 38, 38, 0.95)']].forEach(([phi, col]) => {
      const pv = pvArr(B.pts, phi);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      pv.forEach((v, i) => {
        const x = xp(i, B.pts.length);
        const y = yp(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Axis labels
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('◀ EXTERIOR', pad.l + 4, H - 8);
    ctx.textAlign = 'right';
    ctx.fillText('INTERIOR ▶', pad.l + pw - 4, H - 8);
  };

  // Add layer handlers
  const handleOpenLibrary = (target) => {
    setBibTarget(target);
    setBibFilterG('');
    setBibSearch('');
    setIsBibModalOpen(true);
  };

  const handleAddFromLibrary = (globalIdx) => {
    const m = allMaterials[globalIdx];
    const defaultE = m.e || 0.02;
    const newLayer = { mi: globalIdx, e: defaultE };

    if (bibTarget === 'base') {
      setLayersBase([...layersBase, newLayer]);
    } else {
      setLayersProj([...layersProj, newLayer]);
    }
    setIsBibModalOpen(false);
  };

  const handleRemoveLayer = (caseId, idx) => {
    if (caseId === 'base') {
      setLayersBase(layersBase.filter((_, i) => i !== idx));
    } else {
      setLayersProj(layersProj.filter((_, i) => i !== idx));
    }
  };

  const handleUpdateThickness = (caseId, idx, value) => {
    const val = parseFloat(value) || 0;
    if (caseId === 'base') {
      const copy = [...layersBase];
      copy[idx].e = val;
      setLayersBase(copy);
    } else {
      const copy = [...layersProj];
      copy[idx].e = val;
      setLayersProj(copy);
    }
  };

  // Custom User Material Handlers
  const handleCustomMaterialInputChange = (e) => {
    const { name, value } = e.target;
    setCustomMatForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUserMaterial = () => {
    const { n, lam, e, val } = customMatForm;
    if (!n.trim()) {
      alert('Por favor ingrese un nombre para el material.');
      return;
    }
    const parsedVal = parseFloat(val);
    if (isNaN(parsedVal) || parsedVal <= 0) {
      alert('Ingrese un valor de propiedad de difusión válido.');
      return;
    }

    const parsedLam = parseFloat(lam) || null;
    const parsedE = parseFloat(e) || 0.02;

    const mu = convertedMuValue;
    // Determine vapor barrier
    const isBarrier = (customMatForm.tipo === 'sd' && parsedVal >= 10) || (mu != null && mu * parsedE >= 10);

    const newMaterial = {
      n: n.trim(),
      lam: parsedLam,
      mu,
      e: parsedE,
      sd: customMatForm.tipo === 'sd' ? parsedVal : null,
      R: null,
      fuente: 'Usuario',
      g: 'Usuario',
      barrera: isBarrier
    };

    setUserMats([...userMats, newMaterial]);
    setCustomMatForm({
      n: '',
      lam: '',
      e: '0.02',
      tipo: 'mu',
      val: ''
    });
  };

  const handleRemoveUserMaterial = (idx) => {
    setUserMats(userMats.filter((_, i) => i !== idx));
    // Filter layer selections to remove invalid references
    const globalIdxToRemove = BIBLIOTECA.length + idx;
    setLayersBase(layersBase.filter(l => l.mi !== globalIdxToRemove));
    setLayersProj(layersProj.filter(l => l.mi !== globalIdxToRemove));
  };

  // exportData utility for project state

  const exportData = () => {
    const data = {
      proyecto: projectInfo,
      clima: {
        climaSelected: climate,
        weather: activeWeatherData
      },
      capasBase: layersBase,
      capasProj: layersProj,
      materialesUsuario: userMats
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `condensaciones_${projectInfo.commune || 'proyecto'}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Wizard Steps Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none print:hidden">
        {steps.map((st, idx) => {
          const Icon = st.icon;
          const isActive = activeStep === idx;
          return (
            <button
              key={st.title}
              onClick={() => setActiveStep(idx)}
              className={`flex items-center gap-3 py-3 px-5 border-b-2 text-left transition-all shrink-0 cursor-pointer ${
                isActive 
                  ? 'border-emerald-600 text-emerald-700 font-bold' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-emerald-500/10' : 'bg-slate-100'}`}>
                <Icon size={16} />
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-slate-500">PASO {idx + 1}</div>
                <div className="text-sm font-semibold">{st.title}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="min-h-[300px]">
        {/* STEP 0: PROYECTO */}
        {activeStep === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className="p-1 bg-emerald-500/10 rounded-lg text-emerald-600">📋</span>
                Información del Proyecto
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Propietario</label>
                  <input
                    type="text"
                    value={projectInfo.owner}
                    onChange={(e) => setProjectInfo({ ...projectInfo, owner: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Nombre o Institución"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Profesional Competente</label>
                  <input
                    type="text"
                    value={projectInfo.prof}
                    onChange={(e) => setProjectInfo({ ...projectInfo, prof: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Nombre del Ingeniero/Arquitecto"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dirección del Proyecto</label>
                  <input
                    type="text"
                    value={projectInfo.address}
                    onChange={(e) => setProjectInfo({ ...projectInfo, address: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Calle, número, oficina"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comuna</label>
                  <input
                    type="text"
                    value={projectInfo.commune}
                    onChange={(e) => setProjectInfo({ ...projectInfo, commune: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Ej: Providencia"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RUT Profesional</label>
                  <input
                    type="text"
                    value={projectInfo.rut}
                    onChange={(e) => setProjectInfo({ ...projectInfo, rut: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="12.345.678-9"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</label>
                  <input
                    type="date"
                    value={projectInfo.fecha}
                    onChange={(e) => setProjectInfo({ ...projectInfo, fecha: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-3xl border border-slate-200 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className="p-1 bg-green-100 rounded-lg text-green-700">🏗️</span>
                Sección Constructiva y Orientación física
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción Caso Base</label>
                  <input
                    type="text"
                    value={projectInfo.descBase}
                    onChange={(e) => setProjectInfo({ ...projectInfo, descBase: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción Caso Proyectado</label>
                  <input
                    type="text"
                    value={projectInfo.descProj}
                    onChange={(e) => setProjectInfo({ ...projectInfo, descProj: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Elemento Constructivo</label>
                  <select
                    value={projectInfo.elemType}
                    onChange={(e) => setProjectInfo({ ...projectInfo, elemType: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                  >
                    <option value="muro"  className="bg-white text-slate-800">Muro — flujo horizontal · Rsi=0.13 m²K/W</option>
                    <option value="techo" className="bg-white text-slate-800">Techo — flujo ascendente · Rsi=0.10 m²K/W</option>
                    <option value="piso"  className="bg-white text-slate-800">Piso ventilado — flujo descendente · Rsi=0.17 m²K/W</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Considera Mobiliario</label>
                  <select
                    value={projectInfo.mobiliario}
                    onChange={(e) => setProjectInfo({ ...projectInfo, mobiliario: e.target.value })}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                  >
                    <option value="1" className="bg-white text-slate-800">No — Rsi normal</option>
                    <option value="2" className="bg-white text-slate-800">Sí — Rsi +0.02 m²K/W (muebles adosados)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200/50 rounded-2xl text-emerald-800 text-xs">
              <strong>Nota NCh1973:</strong> Las condiciones fijas de verificación interior corresponden a una temperatura de confort de 19°C y se evalúan frente al mes de Julio (el más desfavorable del invierno en Chile).
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveStep(1)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                Siguiente: Clima
                <span>→</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 1: CLIMA */}
        {activeStep === 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className="p-1 bg-amber-500/10 rounded-lg text-amber-600">🌡️</span>
                Condiciones Climáticas Exteriores
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Región</label>
                  <select
                    value={climate.region}
                    onChange={(e) => {
                      const reg = e.target.value;
                      const provs = REGIONES_CHILE[reg]?.provincias || {};
                      const firstProv = Object.keys(provs)[0] || '';
                      const firstCom = provs[firstProv]?.[0] || '';
                      setClimate({
                        ...climate,
                        region: reg,
                        provincia: firstProv,
                        comuna: firstCom
                      });
                      setProjectInfo(prev => ({ ...prev, commune: firstCom }));
                    }}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer text-xs"
                  >
                    {Object.keys(REGIONES_CHILE).map(r => (
                      <option key={r} value={r} className="bg-white text-slate-800">{r}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Provincia</label>
                  <select
                    value={climate.provincia}
                    onChange={(e) => {
                      const prov = e.target.value;
                      const coms = REGIONES_CHILE[climate.region]?.provincias[prov] || [];
                      const firstCom = coms[0] || '';
                      setClimate({
                        ...climate,
                        provincia: prov,
                        comuna: firstCom
                      });
                      setProjectInfo(prev => ({ ...prev, commune: firstCom }));
                    }}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer text-xs"
                    disabled={!climate.region}
                  >
                    {Object.keys(REGIONES_CHILE[climate.region]?.provincias || {}).map(p => (
                      <option key={p} value={p} className="bg-white text-slate-800">{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comuna</label>
                  <select
                    value={climate.comuna}
                    onChange={(e) => {
                      const com = e.target.value;
                      setClimate({
                        ...climate,
                        comuna: com
                      });
                      setProjectInfo(prev => ({
                        ...prev,
                        commune: com
                      }));
                    }}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer text-xs"
                    disabled={!climate.provincia}
                  >
                    {(REGIONES_CHILE[climate.region]?.provincias[climate.provincia] || []).map(c => (
                      <option key={c} value={c} className="bg-white text-slate-800">{c}</option>
                    ))}
                  </select>
                </div>
                {hasAltitudeOption && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Altitud (MSNM)</label>
                    <select
                      value={climate.altitud}
                      onChange={(e) => {
                        setClimate({
                          ...climate,
                          altitud: e.target.value
                        });
                      }}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer text-xs"
                    >
                      <option value="bajo" className="bg-white text-slate-800">Baja / Valle (&lt; 1.000m)</option>
                      <option value="alto" className="bg-white text-slate-800">Alta / Precordillera (&gt;= 1.000m)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Zona térmica visual badge & description */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-slate-100 border border-slate-200 rounded-2xl">
                <div className="text-center sm:text-left shrink-0">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Zona Térmica NCh1079</div>
                  <div className="text-6xl font-black text-emerald-700 mt-1 flex items-center justify-center sm:justify-start gap-3">
                    {activeZonaTermica}
                    {climate.altitud === 'alto' && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-700 font-bold border border-orange-500/20">
                        ALTITUD
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed border-t sm:border-t-0 sm:border-l border-slate-200 pt-4 sm:pt-0 sm:pl-6">
                  <strong>Descripción Física de la Zona:</strong> {
                    {
                      A: 'Norte árido y costero. Inviernos templados con baja humedad relativa y alta radiación. Bajo riesgo de condensación superficial.',
                      B: 'Norte chico. Clima templado-árido con oscilación térmica diaria considerable en valles interiores.',
                      C: 'Litoral central. Humedad constante por influencia marina directa, inviernos húmedos y frescos.',
                      D: 'Santiago y depresión central. Riesgo moderado con bajas temperaturas matinales y alta polución estacional.',
                      E: 'Central interior y precordillera. Inviernos fríos y húmedos, mayores gradientes de temperatura.',
                      F: 'Centro-sur lluvioso. Lluvias muy frecuentes, humedad ambiente exterior cercana a saturación en invierno.',
                      G: 'Sur y lagos. Alta precipitación anual, clima frío y húmedo con altos requerimientos térmicos.',
                      H: 'Patagonia norte / Altitud Cordillera. Inviernos de frío extremo con heladas severas y nieve habitual.',
                      I: 'Zona austral extrema. Condiciones extremas de congelamiento continuo y vientos de alta velocidad.'
                    }[activeZonaTermica]
                  }
                </div>
              </div>

              {/* Climate stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">T° Ext (Julio) Media Mín</div>
                  <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{activeWeatherData.te.toFixed(1)}°C</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">HR Exterior</div>
                  <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{Math.round(activeWeatherData.hre * 100)}%</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">T° Interior Fija</div>
                  <div className="text-2xl font-bold font-mono text-slate-800 mt-1">19.0°C</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Gradiente ΔT</div>
                  <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{(19 - activeWeatherData.te).toFixed(1)}°C</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className="p-1 bg-emerald-500/10 rounded-lg text-emerald-600">💧</span>
                Nivel de Humedad Relativa Interior para Verificación
              </h2>
              <p className="text-sm text-slate-600">
                Según el procedimiento DITEC, las soluciones deben verificarse a tres humedades relativas fijas (65%, 75% y 80%), las cuales simulan las condiciones normales y críticas del habitar doméstico en Chile.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-100 rounded-2xl text-center border border-slate-200">
                  <div className="text-xs text-slate-500 font-bold">Caso Estándar</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">65%</div>
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl text-center border border-slate-200">
                  <div className="text-xs text-slate-500 font-bold">Caso Húmedo</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">75%</div>
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl text-center border border-slate-200">
                  <div className="text-xs text-slate-500 font-bold">Caso Crítico</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">80%</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setActiveStep(0)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200/50 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 cursor-pointer"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setActiveStep(2)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                Siguiente: Capas
                <span>→</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: CAPAS */}
        {activeStep === 2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Tab switch */}
            <div className="flex gap-2 border-b border-slate-200 pb-1">
              <button
                onClick={() => setActiveCaseTab('base')}
                className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeCaseTab === 'base' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                📐 Caso Base
              </button>
              <button
                onClick={() => setActiveCaseTab('proj')}
                className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeCaseTab === 'proj' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ✏️ Caso Proyectado
              </button>
              <button
                onClick={() => setActiveCaseTab('bib')}
                className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeCaseTab === 'bib' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                📚 Materiales de Usuario
              </button>
            </div>

            {/* TAB CONTENT: CASO BASE O PROYECTADO */}
            {(activeCaseTab === 'base' || activeCaseTab === 'proj') && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-xs text-emerald-400">
                  Las capas se ingresan en orden físico desde el **Exterior (Ext) hacia el Interior (Int)**.
                </div>

                <div className="glass rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 text-center w-12">Pos</th>
                          <th className="py-3 px-4">Material</th>
                          <th className="py-3 px-4 w-28 text-center">Espesor (m)</th>
                          <th className="py-3 px-4 w-24 text-center">λ (W/mK)</th>
                          <th className="py-3 px-4 w-24 text-center">R (m²K/W)</th>
                          <th className="py-3 px-4 w-24 text-center">Sd (m)</th>
                          <th className="py-3 px-4 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(activeCaseTab === 'base' ? layersBase : layersProj).map((l, idx, arr) => {
                          const m = allMaterials[l.mi] || { n: '–', lam: 0.5, mu: 1 };
                          const R = matR(m, l.e);
                          const sd = matSd(m, l.e);
                          const isExt = idx === 0;
                          const isInt = idx === arr.length - 1;

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-4 px-4 text-center text-xs font-bold text-slate-500 font-mono">
                                {isExt ? 'EXT' : isInt ? 'INT' : idx + 1}
                              </td>
                              <td className="py-4 px-4">
                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                  {m.n}
                                  {m.barrera && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold">BV</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {matMuDisp(m)} · {m.fuente}
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0.0001"
                                  value={l.e}
                                  onChange={(e) => handleUpdateThickness(activeCaseTab, idx, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-mono focus:outline-none focus:border-emerald-500 text-slate-800"
                                />
                              </td>
                              <td className="py-4 px-4 text-center text-slate-500 font-mono text-xs">
                                {m.lam != null ? m.lam : (m.R != null ? 'R fijo' : '–')}
                              </td>
                              <td className="py-4 px-4 text-center text-emerald-700 font-semibold font-mono text-xs">
                                {R > 0 ? R.toFixed(3) : '–'}
                              </td>
                              <td className="py-4 px-4 text-center text-slate-500 font-mono text-xs">
                                {sd.toFixed(3)}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => handleRemoveLayer(activeCaseTab, idx)}
                                  className="text-red-600 hover:text-red-500 p-1 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(activeCaseTab === 'base' ? layersBase : layersProj).length === 0 && (
                          <tr>
                            <td colSpan="7" className="py-8 text-center text-slate-500 text-sm">
                              Ninguna capa agregada aún. Haz clic en agregar capa.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add action */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-start">
                    <button
                      onClick={() => handleOpenLibrary(activeCaseTab)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} />
                      Agregar capa desde biblioteca
                    </button>
                  </div>
                </div>

                {/* Totals stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Espesor Total</div>
                    <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                      {Math.round((activeCaseTab === 'base' ? results.base : results.proj).capas.reduce((s, c) => s + c.e, 0) * 1000)} mm
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">RT Capas</div>
                    <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                      {(activeCaseTab === 'base' ? results.base : results.proj).RT_capas.toFixed(3)} m²K/W
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">RT Total (con Rsi+Rse)</div>
                    <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                      {(activeCaseTab === 'base' ? results.base : results.proj).RT.toFixed(3)} m²K/W
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Transmitancia U</div>
                    <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                      {(1 / (activeCaseTab === 'base' ? results.base : results.proj).RT).toFixed(3)} W/m²K
                    </div>
                  </div>
                </div>

                {/* Exigencia térmica OGUC */}
                {ogucCheck.uMax != null && (
                  <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
                    activeCaseTab === 'proj'
                      ? ogucCheck.cumpleProj ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                      : ogucCheck.cumpleBase ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Exigencia Térmica OGUC — Zona {activeZonaTermica} · {activeElemType.label}
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        U máximo exigido: <span className="font-mono font-bold">{ogucCheck.uMax.toFixed(2)} W/m²K</span>
                        <span className="mx-2 text-slate-400">·</span>
                        U obtenido ({activeCaseTab === 'proj' ? 'proyectado' : 'base'}): <span className="font-mono font-bold">{(activeCaseTab === 'proj' ? ogucCheck.uProj : ogucCheck.uBase)?.toFixed(3)} W/m²K</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black ${
                      (activeCaseTab === 'proj' ? ogucCheck.cumpleProj : ogucCheck.cumpleBase)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}>
                      {(activeCaseTab === 'proj' ? ogucCheck.cumpleProj : ogucCheck.cumpleBase)
                        ? '✓ Cumple NCh853'
                        : '✗ No cumple NCh853'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: MATERIALES DE USUARIO */}
            {activeCaseTab === 'bib' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="p-1 bg-emerald-500/10 rounded-lg text-emerald-600"><Sparkles size={14} /></span>
                    Agregar nuevo material personalizado
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">Nombre / Descripción</label>
                      <input
                        type="text"
                        name="n"
                        value={customMatForm.n}
                        onChange={handleCustomMaterialInputChange}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="Ej: Aislante local de paja"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">Conductividad térmica λ (W/mK)</label>
                      <input
                        type="number"
                        step="0.001"
                        name="lam"
                        value={customMatForm.lam}
                        onChange={handleCustomMaterialInputChange}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="Dejar vacío si es barrera fina o cámara"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">Espesor de referencia (m)</label>
                      <input
                        type="number"
                        step="0.001"
                        name="e"
                        value={customMatForm.e}
                        onChange={handleCustomMaterialInputChange}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500">Propiedad de difusión</label>
                        <select
                          name="tipo"
                          value={customMatForm.tipo}
                          onChange={handleCustomMaterialInputChange}
                          className="bg-white border border-slate-200 rounded-xl px-2 py-2.5 text-slate-800 text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="mu" className="bg-white text-slate-800">μ (Factor resist. vapor)</option>
                          <option value="sd" className="bg-white text-slate-800">Sd (Espesor aire equiv. m)</option>
                          <option value="dp_gm" className="bg-white text-slate-800">δp (gm/MNs)</option>
                          <option value="dp_kg" className="bg-white text-slate-800">δp (kg/msPa)</option>
                          <option value="wp" className="bg-white text-slate-800">Wp (kg/m²sPa)</option>
                          <option value="zp_mn" className="bg-white text-slate-800">Zp (MNs/g)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500">Valor</label>
                        <input
                          type="number"
                          step="any"
                          name="val"
                          value={customMatForm.val}
                          onChange={handleCustomMaterialInputChange}
                          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diffusion conversion display */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 flex items-center gap-2">
                    <HelpCircle size={14} className="text-emerald-600" />
                    <span>
                      Conversión NCh 1973: {
                        convertedMuValue != null
                          ? <span>μ equivalente = <strong className="text-slate-900 font-mono">{convertedMuValue >= 1000 ? Math.round(convertedMuValue).toLocaleString('es-CL') : convertedMuValue.toFixed(3)}</strong> {convertedMuValue * parseFloat(customMatForm.e) >= 10 ? <span className="ml-1 text-emerald-600 font-bold">(Funciona como Barrera de Vapor)</span> : ''}</span>
                          : 'Complete los datos de la propiedad para calcular el factor de resistencia equivalente.'
                      }
                    </span>
                  </div>

                  <div className="flex justify-start">
                    <button
                      onClick={handleAddUserMaterial}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Guardar Material en Lista
                    </button>
                  </div>
                </div>

                {/* User materials list table */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Materiales guardados</h3>
                  
                  {userMats.length === 0 ? (
                    <p className="text-xs text-slate-500">Ningún material definido aún. Use el formulario superior.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4">Nombre</th>
                            <th className="py-2.5 px-4 text-center">λ (W/mK)</th>
                            <th className="py-2.5 px-4 text-center">Espesor ref (m)</th>
                            <th className="py-2.5 px-4 text-center">Prop. vapor</th>
                            <th className="py-2.5 px-4 text-center">Barrera</th>
                            <th className="py-2.5 px-4 w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {userMats.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-semibold text-slate-800">{m.n}</td>
                              <td className="py-3 px-4 text-center font-mono text-xs">{m.lam || '–'}</td>
                              <td className="py-3 px-4 text-center font-mono text-xs">{m.e}</td>
                              <td className="py-3 px-4 text-center font-mono text-xs">{matMuDisp(m)}</td>
                              <td className="py-3 px-4 text-center">
                                {m.barrera ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">Barrera</span>
                                ) : 'No'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleRemoveUserMaterial(idx)}
                                  className="text-red-600 hover:text-red-500 p-1 hover:bg-slate-100 rounded cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setActiveStep(1)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200/50 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 cursor-pointer"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setActiveStep(3)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                Calcular y Ver Resultados
                <span>→</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: RESULTADOS */}
        {activeStep === 3 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print:space-y-12">
            
            {/* Sub Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-1 print:hidden">
              <button
                onClick={() => setActiveResultTab('sup')}
                className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeResultTab === 'sup' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                🌡️ Superficial
              </button>
              <button
                onClick={() => setActiveResultTab('int')}
                className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeResultTab === 'int' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                💧 Intersticial
              </button>
              <button
                onClick={() => setActiveResultTab('graf')}
                className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeResultTab === 'graf' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                📊 Perfiles Gráficos
              </button>
              <button
                onClick={() => setActiveResultTab('conc')}
                className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeResultTab === 'conc' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ✅ Conclusiones NCh
              </button>
            </div>

            <div className={activeResultTab === 'sup' ? "space-y-6 block" : "space-y-6 hidden print:block"}>
                <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Evaluación de Riesgo de Condensación Superficial</h3>
                  <p className="text-xs text-slate-500 leading-relaxed print:hidden">
                    La condensación superficial ocurre si la temperatura de la cara interior de la pared {"($T_{si}$)"} cae por debajo de la temperatura de rocío del aire interior {"($T_d$)"}.
                  </p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Solución Analizada</th>
                          <th className="py-3 px-4 text-center">HR 65% (Normal)</th>
                          <th className="py-3 px-4 text-center">HR 75% (Húmedo)</th>
                          <th className="py-3 px-4 text-center">HR 80% (Crítico)</th>
                          <th className="py-3 px-4 text-center">HR Condensación Crítica</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-4 px-4 font-semibold text-slate-800">Caso Base (Existente)</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.base.supRes[0].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.base.supRes[0].cond ? 'Riesgo / SÍ' : 'Seguro / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.base.supRes[1].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.base.supRes[1].cond ? 'Riesgo / SÍ' : 'Seguro / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.base.supRes[2].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.base.supRes[2].cond ? 'Riesgo / SÍ' : 'Seguro / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-amber-600 font-mono text-sm">
                            {(results.base.HR_cond_sup * 100).toFixed(1)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="py-4 px-4 font-semibold text-slate-800">Caso Proyectado (Propuesto)</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.proj.supRes[0].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.proj.supRes[0].cond ? 'Riesgo / SÍ' : 'Seguro / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.proj.supRes[1].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.proj.supRes[1].cond ? 'Riesgo / SÍ' : 'Seguro / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.proj.supRes[2].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.proj.supRes[2].cond ? 'Riesgo / SÍ' : 'Seguro / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-amber-600 font-mono text-sm">
                            {(results.proj.HR_cond_sup * 100).toFixed(1)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Resistencia Térmica Requerida {"($R_T$ mín)"} vs Disponible</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Solución Analizada</th>
                          <th className="py-3 px-4 text-center">RT Disponible (m²K/W)</th>
                          <th className="py-3 px-4 text-center">RT Mín (65% HR)</th>
                          <th className="py-3 px-4 text-center">RT Mín (75% HR)</th>
                          <th className="py-3 px-4 text-center">RT Mín (80% HR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-4 px-4 font-semibold text-slate-800">Caso Base</td>
                          <td className="py-4 px-4 text-center font-mono text-emerald-700 font-bold">{results.base.RT.toFixed(3)}</td>
                          <td className="py-4 px-4 text-center font-mono">{results.base.supRes[0].RT_min.toFixed(3)}</td>
                          <td className="py-4 px-4 text-center font-mono">{results.base.supRes[1].RT_min.toFixed(3)}</td>
                          <td className="py-4 px-4 text-center font-mono">{results.base.supRes[2].RT_min.toFixed(3)}</td>
                        </tr>
                        <tr>
                          <td className="py-4 px-4 font-semibold text-slate-800">Caso Proyectado</td>
                          <td className="py-4 px-4 text-center font-mono text-emerald-700 font-bold">{results.proj.RT.toFixed(3)}</td>
                          <td className="py-4 px-4 text-center font-mono">{results.proj.supRes[0].RT_min.toFixed(3)}</td>
                          <td className="py-4 px-4 text-center font-mono">{results.proj.supRes[1].RT_min.toFixed(3)}</td>
                          <td className="py-4 px-4 text-center font-mono">{results.proj.supRes[2].RT_min.toFixed(3)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>

            <div className={activeResultTab === 'int' ? "space-y-6 block" : "space-y-6 hidden print:block"}>
                <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Evaluación de Riesgo de Condensación Intersticial</h3>
                  <p className="text-xs text-slate-500 leading-relaxed print:hidden">
                    La condensación intersticial ocurre en el interior de la sección si la presión de vapor acumulada {"($P_v$)"} supera la presión de saturación {"($P_{sat}$)"} en cualquier interfaz de capas.
                  </p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Solución Analizada</th>
                          <th className="py-3 px-4 text-center">HR 65% (Normal)</th>
                          <th className="py-3 px-4 text-center">HR 75% (Húmedo)</th>
                          <th className="py-3 px-4 text-center">HR 80% (Crítico)</th>
                          <th className="py-3 px-4 text-center">Puntos con Condensación (65%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-4 px-4 font-semibold text-slate-800">Caso Base</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.base.intRes[0].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.base.intRes[0].cond ? 'RIESGO / SÍ' : 'OK / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.base.intRes[1].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.base.intRes[1].cond ? 'RIESGO / SÍ' : 'OK / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.base.intRes[2].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.base.intRes[2].cond ? 'RIESGO / SÍ' : 'OK / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-slate-500 font-mono">
                            {results.base.intRes[0].nCond}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-4 px-4 font-semibold text-slate-800">Caso Proyectado</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.proj.intRes[0].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.proj.intRes[0].cond ? 'RIESGO / SÍ' : 'OK / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.proj.intRes[1].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.proj.intRes[1].cond ? 'RIESGO / SÍ' : 'OK / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${results.proj.intRes[2].cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {results.proj.intRes[2].cond ? 'RIESGO / SÍ' : 'OK / No'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-slate-500 font-mono">
                            {results.proj.intRes[0].nCond}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Presiones y Temperatura por Interfase - Caso Base (65% HR)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Interfase / Capa</th>
                          <th className="py-2.5 px-4 text-center">T (°C)</th>
                          <th className="py-2.5 px-4 text-center">Pv Real (Pa)</th>
                          <th className="py-2.5 px-4 text-center">Psat Vapor (Pa)</th>
                          <th className="py-2.5 px-4 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-xs">
                        {results.base.intRes[0].ifaces.map((f, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-sans text-slate-800 text-left font-semibold">{f.nombre}</td>
                            <td className="py-3 px-4 text-center text-slate-600">{f.T.toFixed(1)}°</td>
                            <td className="py-3 px-4 text-center text-slate-600">{f.Pv.toFixed(0)} Pa</td>
                            <td className="py-3 px-4 text-center text-slate-600">{f.Psat.toFixed(0)} Pa</td>
                            <td className="py-3 px-4 text-center font-sans">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black ${f.cond ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                {f.cond ? 'CONDENSACIÓN' : 'OK'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>

            <div ref={chartContainerRef} className={activeResultTab === 'graf' ? "space-y-6 block" : "space-y-6 hidden print:block"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                  
                  {/* Temp Gradient */}
                  <div className="glass p-6 rounded-3xl border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span>Perfil de Gradiente de Temperatura</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">Exterior → Interior</span>
                    </h3>
                    <div className="p-2 bg-[#f8fafc] border border-slate-200 rounded-2xl overflow-hidden relative">
                      <canvas ref={tempCanvasRef} className="block w-full" style={{ width: '100%', height: '210px' }}></canvas>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-1 bg-blue-600 rounded-sm"></div>
                        <span>T° Caso Base</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-1 bg-emerald-600 rounded-sm"></div>
                        <span>T° Caso Proyectado</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 border-t border-dashed border-red-500"></div>
                        <span>T° Rocío (65% / 75% / 80% HR)</span>
                      </div>
                    </div>
                  </div>

                  {/* Press vs Saturation */}
                  <div className="glass p-6 rounded-3xl border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span>Presión de Vapor vs Saturación (Glaser)</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">Exterior → Interior</span>
                    </h3>
                    <div className="p-2 bg-[#f8fafc] border border-slate-200 rounded-2xl overflow-hidden">
                      <canvas ref={pressCanvasRef} className="block w-full" style={{ width: '100%', height: '210px' }}></canvas>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-slate-600 font-sans">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-1 bg-blue-600/50 rounded-sm"></div>
                        <span>Psat Base</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-1 bg-emerald-600/50 rounded-sm"></div>
                        <span>Psat Proyectado</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 border-t border-dashed border-red-500"></div>
                        <span>Pv (65% / 75% / 80% HR)</span>
                      </div>
                    </div>
                  </div>

                </div>
            </div>

            <div className={activeResultTab === 'conc' ? "space-y-6 block" : "space-y-6 hidden print:block"}>
                
                {/* Conclusiones boxes */}
                <div className="space-y-4">
                  {/* Superficial eval */}
                  {(() => {
                    const B = results.base;
                    const P = results.proj;
                    const bSup = B.supRes.filter(s => s.cond).length;
                    const pSup = P.supRes.filter(s => s.cond).length;
                    const improvement = pSup < bSup || (bSup === 0 && pSup === 0);

                    if (bSup === 0 && pSup === 0) {
                      return (
                        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 text-emerald-800">
                          <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-600" size={20} />
                          <div>
                            <h4 className="font-bold text-sm">Cumple Condensación Superficial</h4>
                            <p className="text-xs text-emerald-700 mt-1">Ninguna solución constructiva evaluada presenta riesgos de condensación superficial bajo las condiciones estándar e invierno de Julio.</p>
                          </div>
                        </div>
                      );
                    } else if (improvement) {
                      return (
                        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 text-emerald-800">
                          <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-600" size={20} />
                          <div>
                            <h4 className="font-bold text-sm">Mejora Significativa Superficial</h4>
                            <p className="text-xs text-emerald-700 mt-1">El Caso Proyectado disminuye efectivamente o elimina por completo la condensación superficial en comparación al Caso Base. La aislación agregada cumple la norma.</p>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex gap-3 text-rose-800">
                          <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={20} />
                          <div>
                            <h4 className="font-bold text-sm">Riesgo de Condensación Superficial</h4>
                            <p className="text-xs text-rose-700 mt-1">La solución proyectada no disminuye el riesgo superficial. Se recomienda aumentar el espesor del aislante térmico o eliminar puentes de aire en la cara interior.</p>
                          </div>
                        </div>
                      );
                    }
                  })()}

                  {/* Interstitial eval */}
                  {(() => {
                    const B = results.base;
                    const P = results.proj;
                    const bInt = B.intRes.filter(i => i.cond).length;
                    const pInt = P.intRes.filter(i => i.cond).length;
                    const improvement = pInt < bInt || (bInt === 0 && pInt === 0);

                    if (bInt === 0 && pInt === 0) {
                      return (
                        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 text-emerald-800">
                          <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-600" size={20} />
                          <div>
                            <h4 className="font-bold text-sm">Cumple Condensación Intersticial</h4>
                            <p className="text-xs text-emerald-700 mt-1">No se produce condensación en el interior del muro en ninguna de las interfases. La transpiración de vapor de la pared es totalmente estable.</p>
                          </div>
                        </div>
                      );
                    } else if (improvement) {
                      return (
                        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 text-emerald-800">
                          <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-600" size={20} />
                          <div>
                            <h4 className="font-bold text-sm">Mejora Condensación Intersticial</h4>
                            <p className="text-xs text-emerald-700 mt-1">El Caso Proyectado mitiga la acumulación de vapor en el interior de la envolvente constructiva analizada.</p>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex gap-3 text-rose-800">
                          <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={20} />
                          <div>
                            <h4 className="font-bold text-sm">Riesgo de Acumulación Intersticial de Humedad</h4>
                            <p className="text-xs text-rose-700 mt-1">La propuesta proyectada presenta riesgos intersticiales. Considere reordenar las capas, ubicar una **Barrera de Vapor (BV)** en el lado cálido interior o elegir materiales más permeables hacia afuera.</p>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Summary Table */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Resumen General NCh 1973</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Indicador de Desempeño</th>
                          <th className="py-2.5 px-4 text-center">Caso Base</th>
                          <th className="py-2.5 px-4 text-center">Caso Proyectado</th>
                          <th className="py-2.5 px-4 text-center">Evaluación de Mejora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-xs">
                        <tr>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-800">Resistencia Térmica Total {"($R_T$)"}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{results.base.RT.toFixed(3)} m²K/W</td>
                          <td className="py-3 px-4 text-center text-slate-600">{results.proj.RT.toFixed(3)} m²K/W</td>
                          <td className="py-3 px-4 text-center font-sans">
                            {results.proj.RT > results.base.RT ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">Aumenta RT</span>
                            ) : (
                              <span className="text-slate-500">Sin cambio</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-800">
                            Transmitancia Térmica {"($U$)"}
                            {ogucCheck.uMax != null && (
                              <span className="ml-1 text-[10px] font-normal text-slate-500">
                                (máx OGUC: {ogucCheck.uMax.toFixed(2)} W/m²K)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {ogucCheck.uBase?.toFixed(3)} W/m²K
                            {ogucCheck.uMax != null && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${ogucCheck.cumpleBase ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {ogucCheck.cumpleBase ? '✓' : '✗'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {ogucCheck.uProj?.toFixed(3)} W/m²K
                            {ogucCheck.uMax != null && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${ogucCheck.cumpleProj ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {ogucCheck.cumpleProj ? '✓' : '✗'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            {results.proj.RT > results.base.RT ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">Disminuye Pérdida</span>
                            ) : (
                              <span className="text-slate-500">Sin cambio</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-800">T° Superficie Interior {"($T_{si}$)"}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{results.base.T_si.toFixed(1)}°C</td>
                          <td className="py-3 px-4 text-center text-slate-600">{results.proj.T_si.toFixed(1)}°C</td>
                          <td className="py-3 px-4 text-center font-sans">
                            {results.proj.T_si > results.base.T_si ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">Pared más cálida</span>
                            ) : (
                              <span className="text-slate-500">Sin cambio</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-800">HR Crítica (Condensación Superficial)</td>
                          <td className="py-3 px-4 text-center text-slate-600">{Math.round(results.base.HR_cond_sup * 100)}%</td>
                          <td className="py-3 px-4 text-center text-slate-600">{Math.round(results.proj.HR_cond_sup * 100)}%</td>
                          <td className="py-3 px-4 text-center font-sans">
                            {results.proj.HR_cond_sup > results.base.HR_cond_sup ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">Mayor Tolerancia Humedad</span>
                            ) : (
                              <span className="text-slate-500">Sin cambio</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-800">Puntos de Condensación Intersticial (65% HR)</td>
                          <td className="py-3 px-4 text-center text-slate-600">{results.base.intRes[0].nCond}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{results.proj.intRes[0].nCond}</td>
                          <td className="py-3 px-4 text-center font-sans">
                            {results.proj.intRes[0].nCond < results.base.intRes[0].nCond ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">Elimina Riesgo</span>
                            ) : results.proj.intRes[0].nCond === 0 && results.base.intRes[0].nCond === 0 ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50/50 text-emerald-700 border border-emerald-100 text-[10px]">Ambos Seguros</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold">Aún Riesgoso</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Print parameters summary */}
                <div className="hidden print:block bg-white p-6 rounded-2xl border border-slate-200 mt-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Parámetros Ambientales del Reporte</h3>
                  <table className="w-full text-xs text-slate-700">
                    <tbody>
                      <tr className="border-b border-slate-100"><td className="py-2">Comuna / Localidad</td><td className="py-2 text-right">{climate.comuna} ({climate.provincia}, {climate.region})</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2">Zona Térmica NCh1079</td><td className="py-2 text-right">Zona {activeZonaTermica}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2">Temperatura exterior de Julio</td><td className="py-2 text-right">{activeWeatherData.te.toFixed(1)} °C</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2">Humedad relativa exterior</td><td className="py-2 text-right">{Math.round(activeWeatherData.hre * 100)} %</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2">Temperatura interior fijada</td><td className="py-2 text-right">19.0 °C</td></tr>
                      <tr><td className="py-2">Humedad interior evaluada</td><td className="py-2 text-right">65%, 75% y 80%</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
                  >
                    <Printer size={14} />
                    Imprimir Reporte Completo / PDF
                  </button>
                  <button
                    onClick={exportData}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200/50 text-slate-700 font-semibold rounded-xl text-xs transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} />
                    Exportar Datos JSON
                  </button>
                </div>
            </div>

            <div className="flex justify-between print:hidden">
              <button
                onClick={() => setActiveStep(2)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200/50 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 cursor-pointer"
              >
                ← Editar Capas
              </button>
              <button
                onClick={() => {
                  setLayersBase([
                    { mi: 15, e: 0.006 },
                    { mi: 7, e: 0.05 },
                    { mi: 59, e: 0.0125 }
                  ]);
                  setLayersProj([
                    { mi: 15, e: 0.006 },
                    { mi: 7, e: 0.08 },
                    { mi: 11, e: 0.0111 },
                    { mi: 59, e: 0.0125 }
                  ]);
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200/50 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
              >
                <RotateCcw size={16} />
                Reiniciar Muro por Defecto
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* MODAL: SELECT MATERIAL FROM LIBRARY */}
      <AnimatePresence>
        {isBibModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Background Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBibModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  📚 Seleccionar material de biblioteca
                </h3>
                <button
                  onClick={() => setIsBibModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  value={bibSearch}
                  onChange={(e) => setBibSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-slate-400"
                  placeholder="Buscar por nombre, fuente o grupo..."
                />
              </div>

              {/* Filtering Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-none mb-4 shrink-0 border-b border-slate-100 pr-2">
                <button
                  onClick={() => setBibFilterG('')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border shadow-sm ${
                    !bibFilterG 
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📁 Todos
                </button>
                {libraryGroups.map(g => {
                  const isActive = bibFilterG === g;
                  return (
                    <button
                      key={g}
                      onClick={() => setBibFilterG(g)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border shadow-sm ${getCategoryStyles(g, isActive)}`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>

              {/* Materials Scroll List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white pr-1">
                {filteredMaterials.slice(0, 100).map(({ m, i }) => {
                  const hasLam = m.lam != null;
                  const muDisp = matMuDisp(m);
                  const cat = getMaterialCategory(m);
                  const catColorClass = getCategoryStyles(cat, false)
                    .replace('hover:bg-emerald-950/40', '')
                    .replace('hover:bg-amber-950/40', '')
                    .replace('hover:bg-rose-950/40', '')
                    .replace('hover:bg-slate-900/60', '')
                    .replace('hover:bg-sky-950/40', '')
                    .replace('hover:bg-indigo-950/40', '')
                    .replace('hover:bg-teal-950/40', '')
                    .replace('hover:bg-purple-950/40', '')
                    .replace('hover:bg-pink-950/40', '')
                    .replace('hover:bg-fuchsia-950/40', '');

                  return (
                    <div
                      key={i}
                      onClick={() => handleAddFromLibrary(i)}
                      className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center group text-left border-b border-slate-100"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 text-xs group-hover:text-emerald-700 flex items-center gap-1.5 flex-wrap">
                          {m.n}
                          {m.barrera && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-bold">BV</span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${catColorClass}`}>
                            {cat}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {hasLam ? `λ = ${m.lam} W/mK` : (m.R != null ? `R = ${m.R}` : '')}
                          {m.e != null ? ` · e = ${(m.e * 1000).toFixed(1)}mm` : ''}
                          {` · ${muDisp}`}
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold font-mono">
                        {m.fuente}
                      </div>
                    </div>
                  );
                })}
                {filteredMaterials.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-8">Ningún material coincide con la búsqueda.</p>
                )}
              </div>

              <p className="text-[10px] text-slate-500 font-mono mt-3 text-right">
                {filteredMaterials.length} materiales encontrados {filteredMaterials.length > 100 ? '(Mostrando primeros 100)' : ''}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
