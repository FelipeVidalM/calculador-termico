import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Layers, 
  AlertTriangle,
  ArrowRight,
  Calculator,
  RefreshCcw,
  Info
} from 'lucide-react';
import { GLASS_TYPES, FRAME_TYPES, SPACER_TYPES } from '../lib/constants';
import { calculateUw } from '../lib/calculator';
import InfoModal from './InfoModal';
import InputGroup from './InputGroup';

const MODAL_CONTENT = {
  u: {
    title: 'Transmitancia Térmica (Valor U)',
    content: (
      <>
        <p>El valor U ($W/m^2K$) mide la cantidad de calor que se escapa a través de un material por metro cuadrado y por grado de diferencia de temperatura entre el interior y el exterior.</p>
        <p><strong>¿Por qué importa?</strong> Cuanto más bajo sea el valor U, mejor será el aislamiento térmico de la ventana, reduciendo los costos de calefacción y aire acondicionado.</p>
      </>
    )
  },
  r: {
    title: 'Resistencia Térmica (Valor R)',
    content: (
      <>
        <p>El valor R ($m^2K/W$) es el inverso del valor U ($R = 1/U$). Mide la resistencia de un material al flujo de calor.</p>
        <p>A diferencia del valor U, <strong>un valor R más alto significa un mejor aislamiento.</strong> Es común usar R para describir aislantes sólidos como lana de vidrio o poliestireno.</p>
      </>
    )
  },
  psi: {
    title: 'Transmitancia Lineal (Ψ)',
    content: (
      <>
        <p>El valor Ψ ($W/mK$) cuantifica la pérdida de calor a través del puente térmico que se produce en el borde del cristal, donde se encuentra el distanciador (spacer).</p>
        <p>Los distanciadores de aluminio tradicionales tienen un Ψ alto. Los de tecnología "Warm Edge" reducen significativamente esta pérdida.</p>
      </>
    )
  },
  inercia: {
    title: 'Dimensiones y Área',
    content: (
      <>
        <p>El tamaño de la ventana determina la proporción entre el área del vidrio ($A_g$) y el área del marco ($A_f$).</p>
        <p>Dado que los marcos suelen tener una transmitancia diferente (usualmente mayor) a la del vidrio, las dimensiones influyen directamente en el valor global $U_w$.</p>
      </>
    )
  }
};

export default function WindowCalculator() {
  const [inputs, setInputs] = useState({
    width: 1500,
    height: 1200,
    frameWidth: 60,
    glassId: 'dvh-aire',
    frameId: 'pvc',
    spacerId: 'alu'
  });

  const [modal, setModal] = useState({ isOpen: false, key: 'u' });

  const uw = useMemo(() => {
    const glass = GLASS_TYPES.find(g => g.id === inputs.glassId);
    const frame = FRAME_TYPES.find(f => f.id === inputs.frameId);
    const spacer = SPACER_TYPES.find(s => s.id === inputs.spacerId);

    return calculateUw({
      width: inputs.width,
      height: inputs.height,
      frameWidth: inputs.frameWidth,
      ug: glass.uValue,
      uf: frame.uValue,
      psi: spacer.psiValue,
      isMetallicWithoutRPT: frame.material === 'metal' && !frame.rpt,
      isSimpleGlass: glass.id === 'simple'
    });
  }, [inputs]);

  const isDitecAlert = useMemo(() => {
    const glass = GLASS_TYPES.find(g => g.id === inputs.glassId);
    const frame = FRAME_TYPES.find(f => f.id === inputs.frameId);
    return frame.material === 'metal' && !frame.rpt && glass.id === 'simple' && uw === 5.8;
  }, [inputs, uw]);

  const schematicCanvasRef = useRef(null);

  const drawSchematic = () => {
    const cv = schematicCanvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = 400;
    const H = 250;
    const dpr = window.devicePixelRatio || 1;

    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const glass = GLASS_TYPES.find(g => g.id === inputs.glassId);
    const frame = FRAME_TYPES.find(f => f.id === inputs.frameId);
    const spacer = SPACER_TYPES.find(s => s.id === inputs.spacerId);

    // 1. Grid & Guidelines (Subtle tech overlay)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Label coordinates
    ctx.font = '9px monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('NCh 3137-1', 15, 20); // Moved to top-left

    // 1.5 Draw miniature window elevation (bottom-left)
    const mX = 20;
    const mY = 145;
    const mW = 60;
    const mH = 50;

    ctx.save();
    // Background of mini-map
    ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.fillRect(mX - 5, mY - 12, mW + 45, mH + 34);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mX - 5, mY - 12, mW + 45, mH + 34);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('MEDIDAS (mm)', mX, mY - 5);

    // Draw outer frame of mini window
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(mX, mY, mW, mH);

    // Glass infill
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    const scaledF = Math.max(2, Math.min(8, (inputs.frameWidth / 120) * 8));
    ctx.fillRect(mX + scaledF, mY + scaledF, mW - 2 * scaledF, mH - 2 * scaledF);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(mX + scaledF, mY + scaledF, mW - 2 * scaledF, mH - 2 * scaledF);

    // Dimensional line: Width (W)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mX, mY + mH + 4);
    ctx.lineTo(mX + mW, mY + mH + 4);
    ctx.stroke();
    // Arrows for width
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(mX, mY + mH + 4); ctx.lineTo(mX + 3, mY + mH + 2); ctx.lineTo(mX + 3, mY + mH + 6); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mX + mW, mY + mH + 4); ctx.lineTo(mX + mW - 3, mY + mH + 2); ctx.lineTo(mX + mW - 3, mY + mH + 6); ctx.fill();
    // Text Width
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`W:${inputs.width}`, mX + mW/2, mY + mH + 11);

    // Dimensional line: Height (H)
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(mX - 3, mY);
    ctx.lineTo(mX - 3, mY + mH);
    ctx.stroke();
    // Arrows for height
    ctx.beginPath();
    ctx.moveTo(mX - 3, mY); ctx.lineTo(mX - 5, mY + 3); ctx.lineTo(mX - 1, mY + 3); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mX - 3, mY + mH); ctx.lineTo(mX - 5, mY + mH - 3); ctx.lineTo(mX - 1, mY + mH - 3); ctx.fill();
    // Text Height
    ctx.save();
    ctx.translate(mX - 7, mY + mH/2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '7px monospace';
    ctx.fillText(`H:${inputs.height}`, 0, 2);
    ctx.restore();

    // Frame Thickness Callout (cota espesor de marco)
    ctx.fillStyle = '#f87171';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Marco:${inputs.frameWidth}mm`, mX, mY + mH + 19);

    ctx.restore();

    // 2. DRAW FRAME (Bottom part: X = 140 to 260, Y = 170 to 240)
    const fX = 140;
    const fY = 170;
    const fW = 120;
    const fH = 65;

    ctx.save();
    if (frame.id === 'madera') {
      // Wood frame (Wood grains)
      ctx.fillStyle = '#854f07'; // Warm brownish wood
      ctx.fillRect(fX, fY, fW, fH);
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.5;
      // Growth rings
      for (let r = 20; r < 140; r += 15) {
        ctx.beginPath();
        ctx.arc(fX + fW/2, fY + fH + 10, r, Math.PI, 2 * Math.PI);
        ctx.stroke();
      }
    } else if (frame.id === 'pvc') {
      // PVC Frame (multi-chambers)
      ctx.fillStyle = '#334155'; // PVC Body
      ctx.fillRect(fX, fY, fW, fH);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(fX, fY, fW, fH);
      // Inner Chambers (hollow rooms)
      ctx.fillStyle = '#0f172a';
      const cW = 22;
      const cH = 20;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(fX + 7 + i * 27, fY + 8, cW, cH);
        ctx.strokeRect(fX + 7 + i * 27, fY + 8, cW, cH);
        ctx.fillRect(fX + 7 + i * 27, fY + 36, cW, cH);
        ctx.strokeRect(fX + 7 + i * 27, fY + 36, cW, cH);
      }
    } else if (frame.id === 'alu-sin-rpt') {
      // Metallic Aluminum without RPT (cold hollow metal)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(fX, fY, fW, fH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(fX, fY, fW, fH);
      // Hollow inner section
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(fX + 6, fY + 6, fW - 12, fH - 12);
      ctx.strokeRect(fX + 6, fY + 6, fW - 12, fH - 12);
    } else if (frame.id === 'alu-con-rpt') {
      // Aluminum with RPT (Thermal Break polyamide)
      // Left and right metal sections separated by polyamide
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      // Left section
      ctx.fillRect(fX, fY, 45, fH);
      ctx.strokeRect(fX, fY, 45, fH);
      // Right section
      ctx.fillRect(fX + 75, fY, 45, fH);
      ctx.strokeRect(fX + 75, fY, 45, fH);
      // Hollow left/right
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(fX + 6, fY + 6, 33, fH - 12);
      ctx.fillRect(fX + 81, fY + 6, 33, fH - 12);
      // Polyamide thermal break (orange bar) in middle
      ctx.fillStyle = '#ea580c'; // Neon orange polyamide
      ctx.fillRect(fX + 45, fY + 15, 30, fH - 30);
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RPT', fX + 60, fY + fH/2 + 3);
    }
    ctx.restore();

    // 3. DRAW GLASS PANES (Top part: Y = 25 to 170)
    const gY = 25;
    const gH = 145; // Height of glass panes
    ctx.save();
    if (glass.id === 'simple') {
      // Single Glass pane in center X = 200
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(196, gY, 8, gH);
      ctx.strokeRect(196, gY, 8, gH);
      // Shading reflection lines
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.moveTo(202, gY + 10); ctx.lineTo(198, gY + 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(202, gY + 80); ctx.lineTo(198, gY + 100); ctx.stroke();
    } else {
      // Double Glazing (DVH)
      // Left pane (X = 184 to 190) and Right pane (X = 210 to 216)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      
      ctx.fillRect(184, gY, 6, gH);
      ctx.strokeRect(184, gY, 6, gH);
      
      ctx.fillRect(210, gY, 6, gH);
      ctx.strokeRect(210, gY, 6, gH);

      // Gas Cavity interior
      ctx.fillStyle = glass.id === 'dvh-argon' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(190, gY, 20, gH);

      // Lowe Emissivity coating reflection line (yellow neon line inside)
      if (glass.id === 'dvh-lowe') {
        ctx.strokeStyle = '#fbbf24'; // Lowe Yellow Neon line
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(191, gY + 2);
        ctx.lineTo(191, gY + gH - 2);
        ctx.stroke();
        
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('Low-E', 154, gY + 35);
      }

      // Spacer Block (resting at bottom X = 190 to 210, Y = 150 to 170)
      const spY = 148;
      const spH = 22;
      ctx.fillStyle = spacer.id === 'warm-edge' ? '#166534' : '#64748b'; // Warm Edge green vs Aluminum silver
      ctx.fillRect(190, spY, 20, spH);
      ctx.strokeStyle = spacer.id === 'warm-edge' ? '#4ade80' : '#94a3b8';
      ctx.strokeRect(190, spY, 20, spH);
      // Small dots inside spacer (desiccant)
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let dX = 193; dX <= 207; dX += 4) {
        ctx.fillRect(dX, spY + 5, 2, 2);
        ctx.fillRect(dX, spY + 14, 2, 2);
      }

      // Spacer label Psi
      ctx.fillStyle = spacer.id === 'warm-edge' ? '#4ade80' : '#cbd5e1';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(`Ψ = ${spacer.psiValue.toFixed(2)}`, 225, spY + 14);
    }
    ctx.restore();

    // 4. DRAW HEAT FLOW ARROWS & LABELS
    // Interior (Right, warm orange) to Exterior (Left, cold blue)
    ctx.save();
    const arrowY = 90;
    
    // Calculate path transparency based on insulating performance
    // Better insulation = thinner/more transparent arrows. High Uw = thick red/orange lines.
    const heatFlowThickness = Math.max(1, Math.min(8, (uw / 5.8) * 8));
    const flowAlpha = Math.max(0.2, Math.min(1.0, uw / 5.8));

    // Draw frame heat flow arrow (at Y = 205)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(239, 68, 68, ${flowAlpha * 0.8})`; // Red
    ctx.lineWidth = heatFlowThickness * 0.8;
    ctx.moveTo(330, 205);
    ctx.quadraticCurveTo(200, 205, 70, 205);
    ctx.stroke();
    // Arrow Head Exterior
    ctx.fillStyle = `rgba(59, 130, 246, ${flowAlpha})`;
    ctx.beginPath();
    ctx.moveTo(70, 205);
    ctx.lineTo(80, 201);
    ctx.lineTo(80, 209);
    ctx.fill();

    // Draw glass heat flow arrow (at Y = 90)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(249, 115, 22, ${flowAlpha})`; // Orange
    ctx.lineWidth = heatFlowThickness;
    ctx.moveTo(330, arrowY);
    ctx.bezierCurveTo(250, arrowY, 150, arrowY + 10, 70, arrowY);
    ctx.stroke();
    // Arrow Head Exterior
    ctx.fillStyle = `rgba(59, 130, 246, ${flowAlpha})`;
    ctx.beginPath();
    ctx.moveTo(70, arrowY);
    ctx.lineTo(80, arrowY - 4);
    ctx.lineTo(80, arrowY + 4);
    ctx.fill();

    ctx.restore();

    // 5. HUD TEXT LABELS (Dynamic parameters overlay)
    ctx.save();
    // Glass Label
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`Ug = ${glass.uValue.toFixed(1)} W/m²K`, 220, 50);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(glass.name, 220, 62);

    // Frame Label
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`Uf = ${frame.uValue.toFixed(1)} W/m²K`, 15, fY + 30);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(frame.name, 15, fY + 42);

    // Inside / Outside Temperature tags
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#f97316'; // Orange Inside
    ctx.textAlign = 'right';
    ctx.fillText('INTERIOR (Warm)', W - 15, 45);
    ctx.font = '9px monospace';
    ctx.fillStyle = '#fb923c';
    ctx.fillText('Ti = 20 °C', W - 15, 58);

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#3b82f6'; // Blue Outside
    ctx.textAlign = 'left';
    ctx.fillText('EXTERIOR (Cold)', 15, 45);
    ctx.font = '9px monospace';
    ctx.fillStyle = '#60a5fa';
    ctx.fillText('Te = 5 °C', 15, 58);

    // Draw active total result box in corner
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(W - 125, H - 45, 110, 32);
    ctx.strokeRect(W - 125, H - 45, 110, 32);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('GLOBAL RESULT Uw', W - 120, H - 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${uw.toFixed(2)} W/m²K`, W - 120, H - 19);

    ctx.restore();
  };

  useEffect(() => {
    drawSchematic();
  }, [inputs, uw]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: isNaN(value) ? value : Number(value) }));
  };

  const openModal = (key) => setModal({ isOpen: true, key });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:p-0">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Side */}
        <div className="space-y-6 print:hidden">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={18} className="text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Parámetros de Diseño</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Ancho (mm)" id="width" onInfo={() => openModal('inercia')}>
                <input
                  id="width"
                  name="width"
                  type="number"
                  value={inputs.width}
                  onChange={handleInputChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </InputGroup>
              <InputGroup label="Alto (mm)" id="height" onInfo={() => openModal('inercia')}>
                <input
                  id="height"
                  name="height"
                  type="number"
                  value={inputs.height}
                  onChange={handleInputChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </InputGroup>
            </div>

            <InputGroup label="Ancho del Marco (mm)" id="frameWidth" onInfo={() => openModal('psi')}>
              <input
                id="frameWidth"
                name="frameWidth"
                type="number"
                value={inputs.frameWidth}
                onChange={handleInputChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </InputGroup>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers size={18} className="text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Materiales</h2>
            </div>

            <InputGroup label="Tipo de Vidrio" id="glassId" onInfo={() => openModal('u')}>
              <select
                id="glassId"
                name="glassId"
                value={inputs.glassId}
                onChange={handleInputChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
              >
                {GLASS_TYPES.map(g => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-white">{g.name}</option>
                ))}
              </select>
            </InputGroup>

            <InputGroup label="Tipo de Marco" id="frameId" onInfo={() => openModal('r')}>
              <select
                id="frameId"
                name="frameId"
                value={inputs.frameId}
                onChange={handleInputChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
              >
                {FRAME_TYPES.map(f => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">{f.name}</option>
                ))}
              </select>
            </InputGroup>

            <InputGroup label="Distanciador (Spacer)" id="spacerId" onInfo={() => openModal('psi')}>
              <select
                id="spacerId"
                name="spacerId"
                value={inputs.spacerId}
                onChange={handleInputChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
              >
                {SPACER_TYPES.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                ))}
              </select>
            </InputGroup>
          </div>
        </div>

        {/* Results Side */}
        <div className="flex flex-col gap-6 print:w-full">
          <motion.div 
            layout
            className="glass p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden group border border-blue-500/20"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity print:hidden">
              <Calculator size={80} className="text-white" />
            </div>
            
            <span className="text-gray-400 text-sm font-medium uppercase tracking-[0.2em] mb-4">
              Resultado Transmitancia
            </span>
            
            <div className="relative flex items-baseline justify-center">
              <motion.span 
                key={uw}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-7xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent tracking-tighter"
              >
                {uw}
              </motion.span>
              <span className="text-xl font-bold text-blue-400 ml-2">W/m²K</span>
            </div>

            <p className="mt-6 text-gray-400 text-sm leading-relaxed max-w-[280px]">
              Transmitancia Térmica Global de la Ventana ($U_w$) calculada según norma NCh 3137-1.
            </p>

            {isDitecAlert && (
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="mt-8 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-start gap-3 text-left"
              >
                <AlertTriangle className="text-orange-500 shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="text-orange-500 font-bold text-sm">Exigencia DITEC</h4>
                  <p className="text-orange-400/80 text-xs mt-1">
                    Para ventanas metálicas sin RPT y vidrio simple, se establece un valor límite de 5.8 $W/m^2K$.
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Resistencia (R)</p>
              <p className="text-xl font-mono text-white">{(1/uw).toFixed(3)}</p>
              <p className="text-[10px] text-gray-500 font-mono">m²K/W</p>
            </div>
            <div className="glass p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Área Total</p>
              <p className="text-xl font-mono text-white">{(inputs.width * inputs.height / 1000000).toFixed(2)}</p>
              <p className="text-[10px] text-gray-500 font-mono">m²</p>
            </div>
          </div>

          {/* Form parameters summary for Print mode */}
          <div className="hidden print:block glass p-6 rounded-2xl border border-white/5 mt-4">
            <h3 className="text-sm font-bold text-white mb-3">Parámetros del Reporte</h3>
            <table className="w-full text-xs text-gray-300">
              <tbody>
                <tr className="border-b border-white/5"><td className="py-2">Dimensiones</td><td className="py-2 text-right">{inputs.width} x {inputs.height} mm</td></tr>
                <tr className="border-b border-white/5"><td className="py-2">Ancho del Marco</td><td className="py-2 text-right">{inputs.frameWidth} mm</td></tr>
                <tr className="border-b border-white/5"><td className="py-2">Vidrio</td><td className="py-2 text-right">{GLASS_TYPES.find(g => g.id === inputs.glassId)?.name}</td></tr>
                <tr className="border-b border-white/5"><td className="py-2">Marco</td><td className="py-2 text-right">{FRAME_TYPES.find(f => f.id === inputs.frameId)?.name}</td></tr>
                <tr><td className="py-2">Distanciador</td><td className="py-2 text-right">{SPACER_TYPES.find(s => s.id === inputs.spacerId)?.name}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Window Thermal Calculation Schematic */}
          <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Esquema Térmico de Cálculo</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">NCh 3137 / ISO 10077</span>
            </h3>
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0f172a] p-2 flex justify-center">
              <canvas ref={schematicCanvasRef} className="block w-full" style={{ width: '100%', height: '245px', maxWidth: '400px' }}></canvas>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
              El esquema dinámico superior muestra la sección transversal configurada según tus selecciones: tipo de vidrio {"($U_g$)"}, marco {"($U_f$)"} y distanciador (Ψ). El espesor de las flechas ilustra la magnitud del flujo de pérdida de calor.
            </p>
          </div>

          <div className="flex flex-col gap-3 print:hidden">
            <button 
              onClick={handlePrint}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              Generar Reporte PDF / Imprimir
              <ArrowRight size={18} />
            </button>
            <button 
              onClick={() => setInputs({
                width: 1500,
                height: 1200,
                frameWidth: 60,
                glassId: 'dvh-aire',
                frameId: 'pvc',
                spacerId: 'alu'
              })}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all border border-white/5 cursor-pointer"
            >
              <RefreshCcw size={16} />
              Reiniciar Valores
            </button>
          </div>
        </div>
      </section>

      {/* Info Banner */}
      <section className="glass p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent print:hidden">
        <div className="flex gap-4 items-start">
          <div className="p-3 bg-blue-500/10 rounded-xl shrink-0">
            <Info className="text-blue-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white mb-1">Nota Técnica</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Este calculador utiliza el método detallado de la norma chilena NCh 3137-1. Los valores de transmitancia térmica de los materiales son referenciales y pueden variar según fabricante y certificaciones oficiales.
            </p>
          </div>
        </div>
      </section>

      <InfoModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={MODAL_CONTENT[modal.key].title}
        content={MODAL_CONTENT[modal.key].content}
      />
    </div>
  );
}
