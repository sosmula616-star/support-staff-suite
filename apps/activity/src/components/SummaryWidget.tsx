import type { Profile } from '../lib/api';

export function SummaryWidget({ profile }: { profile: Profile }) {
  const tiles = [
    { icon: '🪙', label: 'Токены', value: `${profile.widget.tokens}` },
    {
      icon: '💰',
      label: 'Прогноз зарплаты',
      value: `${profile.widget.salaryForecast} ${profile.widget.currency}`,
    },
    { icon: '🌴', label: 'Отпуск', value: profile.widget.vacation },
    { icon: '⚠️', label: 'Выговоры', value: `${profile.widget.warnings}` },
  ];

  return (
    <section className="card card--summary">
      {tiles.map((tile) => (
        <div key={tile.label} className="tile">
          <span className="tile-icon" aria-hidden="true">
            {tile.icon}
          </span>
          <span className="tile-label">{tile.label}</span>
          <strong className="tile-value">{tile.value}</strong>
        </div>
      ))}
    </section>
  );
}
