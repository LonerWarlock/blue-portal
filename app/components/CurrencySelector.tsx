'use client';

interface Props {
  value: 'INR' | 'USD';
  onChange: (currency: 'INR' | 'USD') => void;
}

export function CurrencySelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Currency</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('INR')}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition ${
            value === 'INR'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'
          }`}
        >
          <span className="text-lg">🇮🇳</span>
          <div>
            <span className="block text-xs font-semibold text-gray-200">INR (India)</span>
            <span className="block text-[10px] text-gray-500">Pay via PayU</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChange('USD')}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition ${
            value === 'USD'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'
          }`}
        >
          <span className="text-lg">🌍</span>
          <div>
            <span className="block text-xs font-semibold text-gray-200">USD (International)</span>
            <span className="block text-[10px] text-gray-500">Pay via PayPal</span>
          </div>
        </button>
      </div>
    </div>
  );
}
