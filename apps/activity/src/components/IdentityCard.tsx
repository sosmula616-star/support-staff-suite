import type { Profile } from '../lib/api';

export function IdentityCard({ profile }: { profile: Profile }) {
  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <section className="card card--identity">
      <div className="avatar-ring">
        {profile.avatarUrl ? (
          <img className="avatar" src={profile.avatarUrl} alt={profile.username} />
        ) : (
          <div className="avatar avatar--fallback">{initials}</div>
        )}
      </div>

      <h2 className="identity-name">{profile.username}</h2>
      <p className="identity-role">{profile.role}</p>

      <dl className="identity-meta">
        <div>
          <dt>Прайм-тайм</dt>
          <dd>{profile.meta.primeSlot ?? 'не назначен'}</dd>
        </div>
        <div>
          <dt>Прогулы за неделю</dt>
          <dd>[{profile.meta.weeklyMisses}]</dd>
        </div>
        {profile.meta.isProbation && (
          <div>
            <dt>Исп. срок</dt>
            <dd className="warn">активен</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
