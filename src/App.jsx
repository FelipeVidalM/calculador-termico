import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, 
  Layers,
  ThermometerSnowflake,
  Activity
} from 'lucide-react';
import WindowCalculator from './components/WindowCalculator';
import CondensationVerifier from './components/CondensationVerifier';

function App() {
  const [activeBlock, setActiveBlock] = useState('window'); // 'window' or 'condensation'

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none print:hidden" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-teal-600/5 blur-[120px] pointer-events-none print:hidden" />

      {/* Header */}
      <header className="p-6 border-b border-white/5 bg-background/40 backdrop-blur-md sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <ThermometerSnowflake className="text-emerald-400 animate-pulse" size={24} />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                NRT · Ingeniería Térmica Integral
              </h1>
              <p className="text-xs text-emerald-500/60 font-mono">
                Cálculos Oficiales NCh 3137 & NCh 1973 · DITEC
              </p>
            </div>
          </div>

          {/* Module Switcher Tab Bar */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 relative">
            <button
              onClick={() => setActiveBlock('window')}
              className={`relative z-10 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                activeBlock === 'window' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame size={14} className={activeBlock === 'window' ? 'text-emerald-400' : ''} />
              Transmitancia de Ventanas
              {activeBlock === 'window' && (
                <motion.div
                  layoutId="activeBlockIndicator"
                  className="absolute inset-0 bg-emerald-700/80 rounded-xl -z-10 shadow-lg shadow-emerald-700/20 border border-emerald-500/20"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveBlock('condensation')}
              className={`relative z-10 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                activeBlock === 'condensation' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={14} className={activeBlock === 'condensation' ? 'text-teal-400' : ''} />
              Verificación de Condensación
              {activeBlock === 'condensation' && (
                <motion.div
                  layoutId="activeBlockIndicator"
                  className="absolute inset-0 bg-teal-700/80 rounded-xl -z-10 shadow-lg shadow-teal-700/20 border border-teal-500/20"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          </div>

          {/* PWA / Offline Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Activity className="text-emerald-500 animate-pulse" size={12} />
            <span className="text-[10px] uppercase tracking-widest font-black text-emerald-400">PWA Ready · Local</span>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="max-w-5xl mx-auto p-6 min-h-[70vh]">
        {/* Printable header */}
        <div className="hidden print:block mb-8 text-center border-b border-black pb-4 text-black font-sans">
          <h1 className="text-2xl font-bold">REPORTE TÉRMICO PROFESIONAL</h1>
          <p className="text-sm font-mono mt-1">NRT INGENIERÍA SUSTENTABLE Y EFICIENCIA ENERGÉTICA</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Cálculo Oficial: {activeBlock === 'window' ? 'Transmitancia Térmica de Ventana (NCh 3137)' : 'Verificación de Condensaciones en Envolvente (NCh 1973 · DITEC)'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeBlock}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            {activeBlock === 'window' ? (
              <WindowCalculator />
            ) : (
              <CondensationVerifier />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto p-12 text-center text-slate-600 border-t border-white/5 mt-12 print:hidden">
        <p className="text-sm font-semibold">NRT Ingeniería Térmica Integral — v2.0.0</p>
        <p className="text-[10px] mt-2 uppercase tracking-widest opacity-60 font-mono">
          Desarrollado para Ingeniería de Alto Desempeño y Cumplimiento Normativo Chileno
        </p>
      </footer>
    </div>
  );
}

export default App;
