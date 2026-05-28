import { useState, useMemo } from 'react';
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
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0f172a] p-2">
              <img 
                src="/window_thermal_diagram.png" 
                alt="Esquema de Transmitancia Térmica Ventanas" 
                className="w-full h-auto object-cover rounded-xl"
              />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
              El valor global de la ventana {"($U_w$)"} se calcula ponderando las áreas y valores del vidrio {"($U_g$)"} y del marco {"($U_f$)"}, sumando la transmitancia lineal del distanciador de borde (Ψ).
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
