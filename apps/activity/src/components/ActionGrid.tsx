import { useState } from 'react';
import type { Profile } from '../lib/api';

interface Props {
  profile: Profile;
  onAction: (action: string, body?: Record<string, unknown>) => Promise<void>;
  onOpenPrimes: () => void;
}

/** Нижняя сетка действий. Блок питомцев намеренно исключён. */
export function ActionGrid({ profile, onAction, onOpenPrimes }: Props) {
  const [prompt, setPrompt] = useState<null | { action: string; title: string; field: string; placeholder: string }>(
    null,
  );
  const [value, setValue] = useState('');

  const buttons: { icon: string; label: string; run: () => void }[] = [
    {
      icon: '⇄',
      label: 'Взять замену',
      run: () =>
        setPrompt({
          action: 'swap',
          title: 'Заявка на замену',
          field: 'slot',
          placeholder: profile.meta.primeSlot ?? '20:00-21:00',
        }),
    },
    {
      icon: '🔍',
      label: 'Взять доп. ПТ',
      run: () =>
        setPrompt({
          action: 'extra',
          title: 'Дополнительный прайм-тайм',
          field: 'slot',
          placeholder: '14:00-15:00',
        }),
    },
    { icon: '🗓️', label: 'Прайм-таймы', run: onOpenPrimes },
    { icon: '📋', label: 'Задания', run: () => void onAction('tasks') },
    {
      icon: '🎫',
      label: 'Промокод',
      run: () =>
        setPrompt({ action: 'promo', title: 'Активация промокода', field: 'code', placeholder: 'SUPPORT2026' }),
    },
    { icon: '🛒', label: 'Магазин', run: () => void onAction('shop') },
    { icon: '🎒', label: 'Инвентарь', run: () => void onAction('inventory') },
    {
      icon: '🌴',
      label: 'Отпуск',
      run: () =>
        setPrompt({ action: 'vacation', title: 'Заявка на отпуск', field: 'until', placeholder: '31.12.2026' }),
    },
  ];

  const submit = async () => {
    if (!prompt) return;
    await onAction(prompt.action, { [prompt.field]: value });
    setPrompt(null);
    setValue('');
  };

  return (
    <>
      <nav className="actions">
        {buttons.map((button) => (
          <button key={button.label} className="action" onClick={button.run}>
            <span className="action-icon" aria-hidden="true">
              {button.icon}
            </span>
            {button.label}
          </button>
        ))}
      </nav>

      {prompt && (
        <div className="overlay" onClick={() => setPrompt(null)}>
          <div className="card card--modal" onClick={(event) => event.stopPropagation()}>
            <h3>{prompt.title}</h3>
            <input
              className="input"
              value={value}
              placeholder={prompt.placeholder}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit();
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => setPrompt(null)}>
                Отмена
              </button>
              <button className="btn btn--primary" onClick={() => void submit()}>
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
