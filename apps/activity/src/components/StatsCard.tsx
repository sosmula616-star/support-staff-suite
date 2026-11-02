import type { Profile } from '../lib/api';

const nf = new Intl.NumberFormat('ru-RU');

export function StatsCard({ profile }: { profile: Profile }) {
  const rows = [
    { icon: '🕒', label: 'Всего на саппорте', value: `${profile.stats.daysOnSupport} дней` },
    { icon: '✅', label: 'Допусков', value: nf.format(profile.stats.approved) },
    { icon: '⛔', label: 'Недопусков', value: nf.format(profile.stats.rejected) },
    { icon: '🎧', label: 'Всего минут в голосовых', value: nf.format(profile.stats.totalVoiceMinutes) },
    { icon: '🔄', label: 'Принятых замен', value: nf.format(profile.stats.acceptedSwaps) },
    { icon: '🎫', label: 'Обработано тикетов', value: nf.format(profile.stats.ticketsProcessed) },
  ];

  return (
    <section className="card card--stats">
      <h3 className="card-title">Статистика саппорта</h3>
      <ul className="stat-list">
        {rows.map((row) => (
          <li key={row.label} className="stat-row">
            <span className="stat-icon" aria-hidden="true">
              {row.icon}
            </span>
            <span className="stat-label">{row.label}</span>
            <span className="stat-value">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
