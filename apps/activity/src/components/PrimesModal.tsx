import { useEffect, useState } from 'react';
import { fetchPrimes, type PrimeRow } from '../lib/api';

export function PrimesModal({ demo, onClose }: { demo: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<PrimeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demo) {
      setRows(
        Array.from({ length: 24 }, (_, hour) => ({
          slot: `${hour}:00-${(hour + 1) % 24}:00`,
          holders: [],
        })),
      );
      return;
    }
    void fetchPrimes()
      .then((data) => setRows(data.table))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [demo]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card card--modal card--wide" onClick={(event) => event.stopPropagation()}>
        <h3>Распределение прайм-таймов</h3>

        {error && <p className="muted">{error}</p>}
        {!rows && !error && <div className="spinner" />}

        {rows && (
          <div className="primes">
            {rows.map((row) => (
              <div key={row.slot} className="prime-cell">
                <span className="prime-slot">{row.slot}</span>
                <span className={row.holders.length ? 'prime-holder' : 'prime-free'}>
                  {row.holders.length
                    ? row.holders.map((h) => `${h.username}${h.isOnVacation ? ' 🌴' : ''}`).join(', ')
                    : 'Свободно'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn--primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
