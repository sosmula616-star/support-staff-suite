import { useCallback, useEffect, useState } from 'react';
import { setupDiscord } from './lib/sdk';
import { demoProfile, fetchProfile, runAction, type Profile } from './lib/api';
import { IdentityCard } from './components/IdentityCard';
import { StatsCard } from './components/StatsCard';
import { SummaryWidget } from './components/SummaryWidget';
import { ActionGrid } from './components/ActionGrid';
import { Toast } from './components/Toast';
import { PrimesModal } from './components/PrimesModal';

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'demo' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [primesOpen, setPrimesOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await fetchProfile());
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const result = await setupDiscord();
      if (result.authed) {
        await load();
        return;
      }
      if (result.error === 'demo') {
        setProfile(demoProfile);
        setStatus('demo');
        return;
      }
      setError(result.error ?? 'неизвестная ошибка');
      setStatus('error');
    })();
  }, [load]);

  const handleAction = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      if (status === 'demo') {
        setToast('Демо-режим: действие недоступно вне Discord.');
        return;
      }
      try {
        const result = await runAction(action, body);
        setToast(result.message);
        await load();
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Не получилось');
      }
    },
    [status, load],
  );

  if (status === 'loading') {
    return (
      <div className="shell shell--center">
        <div className="spinner" />
        <p className="muted">Подключаюсь к Discord…</p>
      </div>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <div className="shell shell--center">
        <div className="card card--error">
          <h2>Не удалось загрузить профиль</h2>
          <p className="muted">{error}</p>
          <button className="btn btn--primary" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>
          Профиль саппорта — <span className="accent">{profile.username}</span>
        </h1>
        <button className="btn btn--ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {status === 'demo' && (
        <div className="banner">Демо-режим — открыто вне Discord, данные тестовые.</div>
      )}

      <main className="grid">
        <IdentityCard profile={profile} />
        <StatsCard profile={profile} />
        <SummaryWidget profile={profile} />
      </main>

      <ActionGrid
        profile={profile}
        onAction={handleAction}
        onOpenPrimes={() => setPrimesOpen(true)}
      />

      {primesOpen && <PrimesModal demo={status === 'demo'} onClose={() => setPrimesOpen(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
