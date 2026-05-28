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

const CONFIGURATIONS = [
  { id: 'fija', name: '1 Hoja Fija', defaultJointMultiplier: 0 },
  { id: '1-hoja-abatible', name: '1 Hoja Móvil Lateral', defaultJointMultiplier: 1 },
  { id: '2-hojas-abatibles', name: '2 Hojas Móviles Laterales', defaultJointMultiplier: 2 },
  { id: 'corredera-2-hojas', name: 'Corredera de 2 Hojas', defaultJointMultiplier: 1.5 },
  { id: 'guillotina', name: 'Guillotina', defaultJointMultiplier: 1.8 }
];

const APERTURE_TYPES = [
  { id: 'fija', name: 'Fija' },
  { id: 'abatible', name: 'Abatible' },
  { id: 'oscilobatiente', name: 'Oscilobatiente' },
  { id: 'corredera', name: 'Corredera' },
  { id: 'proyectante', name: 'Proyectante' }
];

export default function WindowCalculator() {
  const [inputs, setInputs] = useState({
    width: 1500,
    height: 1200,
    frameWidth: 60,
    glassId: 'dvh-aire',
    frameId: 'pvc',
    spacerId: 'alu',
    proportionMode: 'frameProfileHeight', // 'directGlassArea', 'frameFactor', 'frameProfileHeight'
    directGlassArea: 1.49,
    frameFactor: 0.20,
    configId: '2-hojas-abatibles',
    aberturaId: 'abatible',
    jointUserValue: ''
  });

  const [modal, setModal] = useState({ isOpen: false, key: 'u' });

  // Cálculos derivados en tiempo real
  const derivedValues = useMemo(() => {
    const w = inputs.width / 1000;
    const h = inputs.height / 1000;
    const Aw = w * h;

    let Ag = 0;
    let Af = 0;
    let fw = 0;

    if (inputs.proportionMode === 'directGlassArea') {
      Ag = Math.max(0, Math.min(Aw, Number(inputs.directGlassArea)));
      Af = Aw - Ag;
      const r = w / h;
      const wGlass = Math.sqrt(Ag * r);
      fw = Math.max(0, (w - wGlass) / 2);
    } else if (inputs.proportionMode === 'frameFactor') {
      const ff = Math.max(0, Math.min(1, Number(inputs.frameFactor)));
      Af = Aw * ff;
      Ag = Aw - Af;
      const r = w / h;
      const wGlass = Math.sqrt(Ag * r);
      fw = Math.max(0, (w - wGlass) / 2);
    } else {
      fw = inputs.frameWidth / 1000;
      Ag = Math.max(0, (w - 2 * fw) * (h - 2 * fw));
      Af = Aw - Ag;
    }

    // Cálculo matemático del largo de junta operable por defecto
    let defaultJoint = 0;
    if (inputs.configId === '1-hoja-abatible') {
      defaultJoint = 2 * (w + h) - 4 * fw;
    } else if (inputs.configId === '2-hojas-abatibles') {
      defaultJoint = 2 * (w + h) + h - 6 * fw;
    } else if (inputs.configId === 'corredera-2-hojas') {
      defaultJoint = 2 * w + 3 * h - 6 * fw;
    } else if (inputs.configId === 'guillotina') {
      defaultJoint = 3 * w + 2 * h - 6 * fw;
    }
    defaultJoint = Math.max(0, Math.round(defaultJoint * 10) / 10);

    const activeJoint = inputs.jointUserValue !== '' ? Number(inputs.jointUserValue) : defaultJoint;

    return {
      Aw,
      Ag,
      Af,
      fw: Math.round(fw * 1000), // mm para dibujo
      defaultJoint,
      activeJoint
    };
  }, [inputs]);

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
      isSimpleGlass: glass.id === 'simple',
      proportionMode: inputs.proportionMode,
      directGlassArea: inputs.directGlassArea,
      frameFactor: inputs.frameFactor
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

    // 1. Background & Technical Grid
    ctx.fillStyle = '#09110d';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.015)';
    ctx.lineWidth = 0.8;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const glass = GLASS_TYPES.find(g => g.id === inputs.glassId);
    const frame = FRAME_TYPES.find(f => f.id === inputs.frameId);
    const spacer = SPACER_TYPES.find(s => s.id === inputs.spacerId);

    // Header Label
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('ESQUEMA TÉCNICO DE CÁLCULO · NCh 3137 / ISO 10077', W / 2, 14);

    // Helper function for text legibility (stroke outline)
    const drawTextWithOutline = (text, x, y, font, fillStyle, align = 'left') => {
      ctx.save();
      ctx.font = font;
      ctx.textAlign = align;
      ctx.strokeStyle = '#0b0f19';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fillStyle;
      ctx.fillText(text, x, y);
      ctx.restore();
    };

    // ==========================================
    // 2. LEFT COLUMN (Elevation & Frame Cards)
    // ==========================================
    
    // 2.1 Environmental Tag Left (EXTERIOR)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('EXTERIOR: Te = 5°C', 15, 27);
    ctx.restore();

    // 2.2 Elevation Card (Y: 33 to 135)
    const mX = 22;
    const mY = 46;
    const mW = 55;
    const mH = 45;

    ctx.save();
    // Background of mini-map card
    ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.fillRect(12, 33, 105, 98);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 33, 105, 98);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('ELEVACIÓN (mm)', mX - 5, 41);

    // Draw outer frame of mini window
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(mX, mY, mW, mH);

    // Glass infill
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    const scaledF = Math.max(2, Math.min(8, (derivedValues.fw / 120) * 8));
    ctx.fillRect(mX + scaledF, mY + scaledF, mW - 2 * scaledF, mH - 2 * scaledF);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mX + scaledF, mY + scaledF, mW - 2 * scaledF, mH - 2 * scaledF);

    // Dimensional line: Width (W)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mX, mY + mH + 4);
    ctx.lineTo(mX + mW, mY + mH + 4);
    ctx.stroke();
    // Arrows for width
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(mX, mY + mH + 4); ctx.lineTo(mX + 3, mY + mH + 2); ctx.lineTo(mX + 3, mY + mH + 6); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mX + mW, mY + mH + 4); ctx.lineTo(mX + mW - 3, mY + mH + 2); ctx.lineTo(mX + mW - 3, mY + mH + 6); ctx.fill();
    
    // Text Width
    drawTextWithOutline(`W: ${inputs.width}`, mX + mW / 2, mY + mH + 12, 'bold 7px monospace', '#e2e8f0', 'center');

    // Dimensional line: Height (H)
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(mX - 4, mY);
    ctx.lineTo(mX - 4, mY + mH);
    ctx.stroke();
    // Arrows for height
    ctx.beginPath();
    ctx.moveTo(mX - 4, mY); ctx.lineTo(mX - 6, mY + 3); ctx.lineTo(mX - 2, mY + 3); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mX - 4, mY + mH); ctx.lineTo(mX - 6, mY + mH - 3); ctx.lineTo(mX - 2, mY + mH - 3); ctx.fill();
    
    // Text Height
    ctx.save();
    ctx.translate(mX - 8, mY + mH / 2);
    ctx.rotate(-Math.PI / 2);
    drawTextWithOutline(`H: ${inputs.height}`, 0, 2, 'bold 7px monospace', '#e2e8f0', 'center');
    ctx.restore();

    // Frame Thickness Callout
    drawTextWithOutline(`Marco: ${derivedValues.fw}mm`, mX - 5, mY + mH + 22, 'bold 7px monospace', '#f87171');
    ctx.restore();

    // 2.3 Frame properties card (Left Bottom Y: 148 to 238)
    const cardY = 148;
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
    ctx.fillRect(12, cardY, 105, 90);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, cardY, 105, 90);

    // Text details
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('MARCO (Frame)', 18, cardY + 14);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`Uf = ${frame.uValue.toFixed(2)}`, 18, cardY + 30);
    
    ctx.font = '7px sans-serif';
    ctx.fillStyle = '#94a3b8';
    
    // Text wrapping for frame name to prevent spilling out
    const frameWords = frame.name.split(' ');
    let line1 = '';
    let line2 = '';
    for (let word of frameWords) {
      if ((line1 + word).length < 20) {
        line1 += (line1 ? ' ' : '') + word;
      } else {
        line2 += (line2 ? ' ' : '') + word;
      }
    }
    ctx.fillText(line1, 18, cardY + 45);
    if (line2) {
      ctx.fillText(line2.length > 20 ? line2.substring(0, 18) + '..' : line2, 18, cardY + 54);
    }
    
    ctx.fillStyle = '#64748b';
    ctx.font = '7px monospace';
    ctx.fillText(`Material: ${frame.material.toUpperCase()}`, 18, cardY + 74);
    if (frame.rpt) {
      ctx.fillStyle = '#fb923c';
      ctx.fillText('✓ C/ Puente Térmico', 18, cardY + 83);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('✗ S/ Puente Térmico', 18, cardY + 83);
    }
    ctx.restore();


    // ==========================================
    // 3. RIGHT COLUMN (Glass & Uw Result Cards)
    // ==========================================
    
    // 3.1 Environmental Tag Right (INTERIOR)
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = '#f97316';
    ctx.fillText('INTERIOR: Ti = 20°C', W - 15, 27);
    ctx.restore();

    // 3.2 Glass Ug properties card (Right Top Y: 33 to 135)
    const gCardY = 33;
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.fillRect(283, gCardY, 105, 98);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(283, gCardY, 105, 98);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('VIDRIO (Glass)', 289, gCardY + 14);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`Ug = ${glass.uValue.toFixed(2)}`, 289, gCardY + 30);
    
    ctx.font = '7px sans-serif';
    ctx.fillStyle = '#94a3b8';
    
    // Text wrapping for glass name
    const glassWords = glass.name.split(' ');
    let gLine1 = '';
    let gLine2 = '';
    for (let word of glassWords) {
      if ((gLine1 + word).length < 20) {
        gLine1 += (gLine1 ? ' ' : '') + word;
      } else {
        gLine2 += (gLine2 ? ' ' : '') + word;
      }
    }
    ctx.fillText(gLine1, 289, gCardY + 45);
    if (gLine2) {
      ctx.fillText(gLine2.length > 20 ? gLine2.substring(0, 18) + '..' : gLine2, 289, gCardY + 54);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '7px monospace';
    ctx.fillText(`Tipo: ${glass.id === 'simple' ? 'SIMPLE' : 'DVH (Doble)'}`, 289, gCardY + 74);
    ctx.fillText(`Capa: ${glass.id.includes('lowe') ? 'Bajo Emisivo' : 'Estándar'}`, 289, gCardY + 83);
    ctx.restore();

    // 3.3 Global result Uw box (Right Bottom Y: 148 to 238)
    const resCardY = 148;
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.fillRect(283, resCardY, 105, 90);
    ctx.strokeRect(283, resCardY, 105, 90);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('RESULTADO GLOBAL', 289, resCardY + 16);
    ctx.fillText('DE LA VENTANA Uw', 289, resCardY + 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${uw.toFixed(2)}`, 289, resCardY + 52);
    
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('W/m²K', 289, resCardY + 66);
    
    ctx.fillStyle = '#64748b';
    ctx.font = '6px monospace';
    ctx.fillText('MÉTODO DETALLADO', 289, resCardY + 81);
    ctx.restore();


    // ==========================================
    // 4. CENTER COLUMN (Cross-section schematic)
    // ==========================================
    const cX = 200; // Recenter perfectly

    // 4.1 DRAW FRAME PROFILE (X = 160 to 240, Y = 150 to 238)
    const fProfileX = cX - 40; // 160
    const fProfileY = 150;
    const fProfileW = 80;
    const fProfileH = 88;

    ctx.save();
    if (frame.id === 'madera') {
      ctx.fillStyle = '#653e0d';
      ctx.fillRect(fProfileX, fProfileY, fProfileW, fProfileH);
      ctx.strokeStyle = '#854f07';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(fProfileX, fProfileY, fProfileW, fProfileH);
      // Wood grain lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let r = 20; r < 120; r += 15) {
        ctx.beginPath();
        ctx.arc(fProfileX + fProfileW / 2, fProfileY + fProfileH + 10, r, Math.PI, 2 * Math.PI);
        ctx.stroke();
      }
    } else if (frame.id === 'pvc') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(fProfileX, fProfileY, fProfileW, fProfileH);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fProfileX, fProfileY, fProfileW, fProfileH);
      
      // PVC Chambers
      ctx.fillStyle = '#0b0f19';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      const cW = 18;
      const cH = 20;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillRect(fProfileX + 6 + col * 24, fProfileY + 8 + row * 26, cW, cH);
          ctx.strokeRect(fProfileX + 6 + col * 24, fProfileY + 8 + row * 26, cW, cH);
        }
      }
    } else if (frame.id === 'alu-sin-rpt') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(fProfileX, fProfileY, fProfileW, fProfileH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fProfileX, fProfileY, fProfileW, fProfileH);
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(fProfileX + 6, fProfileY + 6, fProfileW - 12, fProfileH - 12);
      ctx.strokeRect(fProfileX + 6, fProfileY + 6, fProfileW - 12, fProfileH - 12);
    } else if (frame.id === 'alu-con-rpt') {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      // Metal halves
      ctx.fillRect(fProfileX, fProfileY, 30, fProfileH);
      ctx.strokeRect(fProfileX, fProfileY, 30, fProfileH);
      ctx.fillRect(fProfileX + 50, fProfileY, 30, fProfileH);
      ctx.strokeRect(fProfileX + 50, fProfileY, 30, fProfileH);
      // Hollow interiors
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(fProfileX + 5, fProfileY + 5, 20, fProfileH - 10);
      ctx.fillRect(fProfileX + 55, fProfileY + 5, 20, fProfileH - 10);
      
      // Polyamide insulation thermal break (RPT) in the middle
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(fProfileX + 30, fProfileY + 16, 20, fProfileH - 32);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(fProfileX + 30, fProfileY + 16, 20, 4);
      ctx.fillRect(fProfileX + 30, fProfileY + fProfileH - 20, 20, 4);

      drawTextWithOutline('RPT', fProfileX + 40, fProfileY + fProfileH / 2 + 2, 'bold 7px sans-serif', '#fb923c', 'center');
    }
    ctx.restore();

    // 4.2 DRAW GLASS PANES (Top part: Y = 33 to 150)
    const gY = 33;
    const gH = 117;
    ctx.save();
    if (glass.id === 'simple') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(cX - 4, gY, 8, gH);
      ctx.strokeRect(cX - 4, gY, 8, gH);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath(); ctx.moveTo(cX + 2, gY + 20); ctx.lineTo(cX - 2, gY + 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cX + 2, gY + 70); ctx.lineTo(cX - 2, gY + 90); ctx.stroke();
    } else {
      // DVH panes: Left at cX - 14, Right at cX + 6
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      
      ctx.fillRect(cX - 14, gY, 6, gH);
      ctx.strokeRect(cX - 14, gY, 6, gH);
      
      ctx.fillRect(cX + 8, gY, 6, gH);
      ctx.strokeRect(cX + 8, gY, 6, gH);

      // Cavity
      ctx.fillStyle = glass.id === 'dvh-argon' ? 'rgba(34, 197, 94, 0.03)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(cX - 8, gY, 16, gH);

      // Lowe coating line
      if (glass.id === 'dvh-lowe') {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cX - 7, gY + 2);
        ctx.lineTo(cX - 7, gY + gH - 2);
        ctx.stroke();
      }

      // Spacer Block (resting at Y = 130 to 148)
      const spY = 130;
      const spH = 18;
      ctx.fillStyle = spacer.id === 'warm-edge' ? '#14532d' : '#475569';
      ctx.fillRect(cX - 8, spY, 16, spH);
      ctx.strokeStyle = spacer.id === 'warm-edge' ? '#22c55e' : '#94a3b8';
      ctx.strokeRect(cX - 8, spY, 16, spH);

      // Spacer Psi Label (X = cX + 15, Y = 141)
      drawTextWithOutline(
        `Ψ: ${spacer.psiValue.toFixed(2)}`, 
        cX + 12, 
        spY + 11, 
        'bold 7px monospace', 
        spacer.id === 'warm-edge' ? '#4ade80' : '#cbd5e1'
      );
    }
    ctx.restore();


    // ==========================================
    // 5. DRAW HEAT FLOW ARROWS (Middle Spans)
    // ==========================================
    ctx.save();
    
    // Confined bounds for arrows: from X = 250 (right) to X = 138 (left)
    const arrowStartX = 250;
    const arrowEndX = 138;
    const flowAlpha = Math.max(0.3, Math.min(1.0, uw / 5.8));
    const heatFlowThickness = Math.max(1.5, Math.min(7.5, (uw / 5.8) * 7.5));

    // 5.1 Glass Heat Arrow (Y = 90)
    const glassArrowY = 90;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(249, 115, 22, ${flowAlpha})`;
    ctx.lineWidth = heatFlowThickness;
    ctx.moveTo(arrowStartX, glassArrowY);
    ctx.bezierCurveTo(arrowStartX - 30, glassArrowY, cX + 20, glassArrowY + 10, arrowEndX, glassArrowY);
    ctx.stroke();
    
    // Arrow Head Left (Exterior)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(arrowEndX, glassArrowY);
    ctx.lineTo(arrowEndX + 7, glassArrowY - 3.5);
    ctx.lineTo(arrowEndX + 7, glassArrowY + 3.5);
    ctx.fill();

    // 5.2 Frame Heat Arrow (Y = 177)
    const frameArrowY = 177;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(239, 68, 68, ${flowAlpha * 0.9})`;
    ctx.lineWidth = heatFlowThickness * 0.8;
    ctx.moveTo(arrowStartX, frameArrowY);
    ctx.quadraticCurveTo(cX + 10, frameArrowY, arrowEndX, frameArrowY);
    ctx.stroke();
    
    // Arrow Head Left (Exterior)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(arrowEndX, frameArrowY);
    ctx.lineTo(arrowEndX + 7, frameArrowY - 3.5);
    ctx.lineTo(arrowEndX + 7, frameArrowY + 3.5);
    ctx.fill();

    ctx.restore();
  };

  useEffect(() => {
    drawSchematic();
  }, [inputs, uw, derivedValues]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: isNaN(value) ? value : Number(value) }));
  };

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
              <Settings size={18} className="text-emerald-400" />
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </InputGroup>
              <InputGroup label="Alto (mm)" id="height" onInfo={() => openModal('inercia')}>
                <input
                  id="height"
                  name="height"
                  type="number"
                  value={inputs.height}
                  onChange={handleInputChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </InputGroup>
            </div>
            <div className="text-right text-xs text-emerald-400 font-mono">
              Área total ventana, Aw: <span className="font-bold text-white">{(inputs.width * inputs.height / 1000000).toFixed(2)} m²</span>
            </div>

            {/* Alternativas de Proporción Marco/Vidrio */}
            <div className="glass p-4 rounded-2xl border border-white/5 space-y-4">
              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Proporción marco vidrio:</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${inputs.proportionMode === 'directGlassArea' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'}`}>
                  <input 
                    type="radio" 
                    name="proportionMode" 
                    value="directGlassArea" 
                    checked={inputs.proportionMode === 'directGlassArea'} 
                    onChange={(e) => setInputs(prev => ({ ...prev, proportionMode: e.target.value }))}
                    className="accent-emerald-500"
                  />
                  Alternativa 1 (Ag)
                </label>
                <label className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${inputs.proportionMode === 'frameFactor' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'}`}>
                  <input 
                    type="radio" 
                    name="proportionMode" 
                    value="frameFactor" 
                    checked={inputs.proportionMode === 'frameFactor'} 
                    onChange={(e) => setInputs(prev => ({ ...prev, proportionMode: e.target.value }))}
                    className="accent-emerald-500"
                  />
                  Alternativa 2 (Factor)
                </label>
                <label className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${inputs.proportionMode === 'frameProfileHeight' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'}`}>
                  <input 
                    type="radio" 
                    name="proportionMode" 
                    value="frameProfileHeight" 
                    checked={inputs.proportionMode === 'frameProfileHeight'} 
                    onChange={(e) => setInputs(prev => ({ ...prev, proportionMode: e.target.value }))}
                    className="accent-emerald-500"
                  />
                  Alternativa 3 (Perfil)
                </label>
              </div>

              {inputs.proportionMode === 'directGlassArea' && (
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-xs text-gray-400 font-semibold">Área vidrio, Ag (m²):</label>
                  <input 
                    type="number"
                    step="0.001"
                    name="directGlassArea"
                    value={inputs.directGlassArea}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-xs"
                  />
                </div>
              )}

              {inputs.proportionMode === 'frameFactor' && (
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-xs text-gray-400 font-semibold">Factor de marco (0.00 - 1.00):</label>
                  <input 
                    type="number"
                    step="0.01"
                    name="frameFactor"
                    value={inputs.frameFactor}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-xs"
                  />
                </div>
              )}

              {inputs.proportionMode === 'frameProfileHeight' && (
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-xs text-gray-400 font-semibold">Altura de marco (mm):</label>
                  <input 
                    type="number"
                    name="frameWidth"
                    value={inputs.frameWidth}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5 text-xs text-gray-300 font-mono">
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Área marco, Af:</div>
                  <div className="text-xs font-bold text-white">{derivedValues.Af.toFixed(3)} m²</div>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Área vidrio, Ag:</div>
                  <div className="text-xs font-bold text-white">{derivedValues.Ag.toFixed(3)} m²</div>
                </div>
              </div>
            </div>

            {/* Configuración y Tipo de Abertura */}
            <div className="glass p-4 rounded-2xl border border-white/5 space-y-4">
              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Junta Operable e Infiltraciones:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 font-semibold">Configuración:</label>
                  <select
                    name="configId"
                    value={inputs.configId}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-xs cursor-pointer bg-slate-900"
                  >
                    {CONFIGURATIONS.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 font-semibold">Tipo abertura:</label>
                  <select
                    name="aberturaId"
                    value={inputs.aberturaId}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-xs cursor-pointer bg-slate-900"
                  >
                    {APERTURE_TYPES.map(a => (
                      <option key={a.id} value={a.id} className="bg-slate-900 text-white">{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Por defecto:</div>
                  <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-gray-400 font-mono text-xs">
                    {derivedValues.defaultJoint.toFixed(1)} m
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Valor usuario:</div>
                  <input 
                    type="number"
                    step="0.1"
                    name="jointUserValue"
                    placeholder="Auto..."
                    value={inputs.jointUserValue}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Layers size={18} className="text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Materiales de Biblioteca</h2>
            </div>

            <InputGroup label="Tipo de Vidrio" id="glassId" onInfo={() => openModal('u')}>
              <select
                id="glassId"
                name="glassId"
                value={inputs.glassId}
                onChange={handleInputChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
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
            className="glass p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden group border border-emerald-500/20"
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
                className="text-7xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent tracking-tighter"
              >
                {uw}
              </motion.span>
              <span className="text-xl font-bold text-emerald-400 ml-2">W/m²K</span>
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
              <p className="text-xl font-mono text-white">{derivedValues.Aw.toFixed(2)}</p>
              <p className="text-[10px] text-gray-500 font-mono">m²</p>
            </div>
          </div>

          {/* Form parameters summary for Print mode */}
          <div className="hidden print:block glass p-6 rounded-2xl border border-white/5 mt-4">
            <h3 className="text-sm font-bold text-white mb-3">Parámetros del Reporte (Ventana NCh 3137)</h3>
            <table className="w-full text-xs text-gray-300">
              <tbody>
                <tr className="border-b border-white/5"><td className="py-2">Dimensiones</td><td className="py-2 text-right">{inputs.width} x {inputs.height} mm (Aw: {derivedValues.Aw.toFixed(2)} m²)</td></tr>
                <tr className="border-b border-white/5"><td className="py-2">Proporción Marco/Vidrio</td><td className="py-2 text-right">
                  {inputs.proportionMode === 'directGlassArea' && `Alternativa 1 (Ag direct: ${inputs.directGlassArea} m²)`}
                  {inputs.proportionMode === 'frameFactor' && `Alternativa 2 (Factor: ${inputs.frameFactor})`}
                  {inputs.proportionMode === 'frameProfileHeight' && `Alternativa 3 (Ancho perfil: ${inputs.frameWidth} mm)`}
                </td></tr>
                <tr className="border-b border-white/5"><td className="py-2">Áreas Efectivas</td><td className="py-2 text-right">Af: {derivedValues.Af.toFixed(3)} m² | Ag: {derivedValues.Ag.toFixed(3)} m²</td></tr>
                <tr className="border-b border-white/5"><td className="py-2">Configuración</td><td className="py-2 text-right">{CONFIGURATIONS.find(c => c.id === inputs.configId)?.name} ({APERTURE_TYPES.find(a => a.id === inputs.aberturaId)?.name})</td></tr>
                <tr className="border-b border-white/5"><td className="py-2">Junta Operable</td><td className="py-2 text-right">Por defecto: {derivedValues.defaultJoint.toFixed(1)} m | Usuario: {inputs.jointUserValue !== '' ? `${inputs.jointUserValue} m` : 'Auto'}</td></tr>
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
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#070b12] p-2 flex justify-center">
              <canvas ref={schematicCanvasRef} className="block w-full" style={{ width: '100%', height: '245px', maxWidth: '400px' }}></canvas>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
              El esquema dinámico superior muestra la sección transversal configurada según tus selecciones: tipo de vidrio {"($U_g$)"}, marco {"($U_f$)"} y distanciador (Ψ). El espesor de las flechas ilustra la magnitud del flujo de pérdida de calor.
            </p>
          </div>

          <div className="flex flex-col gap-3 print:hidden">
            <button 
              onClick={handlePrint}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
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
                spacerId: 'alu',
                proportionMode: 'frameProfileHeight',
                directGlassArea: 1.49,
                frameFactor: 0.20,
                configId: '2-hojas-abatibles',
                aberturaId: 'abatible',
                jointUserValue: ''
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
          <div className="p-3 bg-emerald-500/10 rounded-xl shrink-0">
            <Info className="text-emerald-400" size={24} />
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
