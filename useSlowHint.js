import { useEffect, useState } from 'react';

// Возвращает true, если `active` остаётся true дольше `ms` миллисекунд.
// Нужен для холодного старта: бесплатный сервер на Render «спит» и просыпается до минуты
export function useSlowHint(active, ms = 3000) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);

  return slow;
}
