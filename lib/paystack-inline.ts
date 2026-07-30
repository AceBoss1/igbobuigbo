// lib/paystack-inline.ts
export interface PaystackConfig {
  email:     string;
  amount:    number;
  ref:       string;
  currency?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (response: { reference: string }) => void;
  onClose:   () => void;
}

const SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).PaystackPop) { resolve(); return; }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Paystack script failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_URL; s.async = true;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('Could not load Paystack. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

export async function openPaystack(config: PaystackConfig) {
  const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  if (!key || (!key.startsWith('pk_test_') && !key.startsWith('pk_live_'))) {
    throw new Error(
      `Invalid or missing Paystack key. Current value: "${key?.slice(0, 15) ?? 'undefined'}"\n` +
      'Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxx in .env.local'
    );
  }

  await loadScript();

  const PaystackPop = (window as any).PaystackPop;
  if (!PaystackPop) throw new Error('PaystackPop unavailable after script load');

  const isTest = key.startsWith('pk_test_');
  if (isTest && config.amount < 10000) config = { ...config, amount: 10000 };

  // IMPORTANT: callback and onClose MUST be plain function references,
  // not arrow functions assigned inline — Paystack validates typeof === 'function'
  const successFn = config.onSuccess;
  const closeFn   = config.onClose;

  function onPaystackSuccess(res: { reference: string }) { successFn(res); }
  function onPaystackClose() { closeFn(); }

  const handler = PaystackPop.setup({
    key,
    email:    config.email || 'member@igbobuigbo.org.ng',
    amount:   config.amount,
    ref:      config.ref,
    metadata: config.metadata ?? {},
    currency: config.currency ?? 'NGN',
    label:    'Igbo Bu Igbo IBI',
    callback: onPaystackSuccess,
    onClose:  onPaystackClose,
  });

  handler.openIframe();
}
