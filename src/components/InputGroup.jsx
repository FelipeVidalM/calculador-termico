import { HelpCircle } from 'lucide-react';

export default function InputGroup({ label, id, onInfo, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-gray-400">
          {label}
        </label>
        <button
          type="button"
          onClick={onInfo}
          className="text-gray-500 hover:text-blue-400 transition-colors"
          aria-label={`Información sobre ${label}`}
        >
          <HelpCircle size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}
