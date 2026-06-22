import fs from 'fs';
import path from 'path';

const filePath = 'c:/Users/felip/OneDrive/Escritorio/APLICACIONES NRT/calculador-termico/src/components/CondensationVerifier.jsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replacements for a premium forest green sustainability theme
content = content.replace(/blue-600/g, 'emerald-600');
content = content.replace(/blue-500/g, 'emerald-500');
content = content.replace(/blue-400/g, 'emerald-400');
content = content.replace(/indigo-600/g, 'teal-600');
content = content.replace(/indigo-500/g, 'teal-500');
content = content.replace(/indigo-400/g, 'teal-400');
content = content.replace(/bg-blue-500/g, 'bg-emerald-500');
content = content.replace(/border-blue-500/g, 'border-emerald-500');
content = content.replace(/text-blue-400/g, 'text-emerald-400');
content = content.replace(/focus:ring-blue-500/g, 'focus:ring-emerald-500');
content = content.replace(/focus:border-blue-500/g, 'focus:border-emerald-500');
content = content.replace(/shadow-blue-500/g, 'shadow-emerald-500');
content = content.replace(/shadow-blue-600/g, 'shadow-emerald-600');

// Dynamic canvas profile background inside CondensationVerifier
content = content.replace(/#0f172a/g, '#070b12'); // Profile background
content = content.replace(/#1e293b/g, '#09110d'); // Card background

fs.writeFileSync(filePath, content, 'utf-8');
console.log('CondensationVerifier colors updated successfully to forest green/teal!');
