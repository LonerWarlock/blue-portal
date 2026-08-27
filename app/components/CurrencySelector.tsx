'use client';

interface Props {
  value: 'INR' | 'USD';
  onChange: (currency: 'INR' | 'USD') => void;
}

export function CurrencySelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="eyebrow">Currency</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('INR')}
          className={`flex items-center gap-2 p-3 rounded-md border text-left transition-colors duration-150 ${
            value === 'INR'
              ? 'border-brand bg-brand/5'
              : 'border-line bg-paper hover:border-line-strong'
          }`}
        >
          <span className="text-lg">🇮🇳</span>
          <div>
            <span className="block text-xs font-semibold text-ink">INR (India)</span>
            <span className="block text-[10px] text-ink-faint">Pay via PayU</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChange('USD')}
          className={`flex items-center gap-2 p-3 rounded-md border text-left transition-colors duration-150 ${
            value === 'USD'
              ? 'border-brand bg-brand/5'
              : 'border-line bg-paper hover:border-line-strong'
          }`}
        >
          <span className="text-lg">🌍</span>
          <div>
            <span className="block text-xs font-semibold text-ink">USD (International)</span>
            <span className="block text-[10px] text-ink-faint">Pay via PayPal</span>
          </div>
        </button>
      </div>
    </div>
  );
}
