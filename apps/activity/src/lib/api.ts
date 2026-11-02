import { apiBase, getAccessToken } from './sdk';

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  stats: {
    daysOnSupport: number;
    approved: number;
    rejected: number;
    totalVoiceMinutes: number;
    acceptedSwaps: number;
    ticketsProcessed: number;
  };
  widget: {
    tokens: number;
    salaryForecast: string;
    currency: string;
    vacation: string;
    warnings: number;
  };
  meta: {
    joinDate: string;
    primeSlot: string | null;
    isProbation: boolean;
    probationEnd: string | null;
    weeklyMisses: number;
    passMinutes: number;
  };
}

export interface PrimeRow {
  slot: string;
  holders: { id: string; username: string; primeSlot: string | null; isOnVacation: boolean }[];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export const fetchProfile = () => request<Profile>('/profile');
export const fetchPrimes = () => request<{ table: PrimeRow[] }>('/primes');

export const runAction = (name: string, body: Record<string, unknown> = {}) =>
  request<{ ok: boolean; message: string }>(`/actions/${name}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** Демо-данные для запуска вне Discord. */
export const demoProfile: Profile = {
  id: '000000000000000000',
  username: 'desireee00',
  avatarUrl: null,
  role: 'Саппорт',
  stats: {
    daysOnSupport: 18,
    approved: 655,
    rejected: 15,
    totalVoiceMinutes: 3965,
    acceptedSwaps: 20,
    ticketsProcessed: 23,
  },
  widget: {
    tokens: 685,
    salaryForecast: '25',
    currency: '₽',
    vacation: 'До 02.11.26',
    warnings: 0,
  },
  meta: {
    joinDate: new Date().toISOString(),
    primeSlot: '20:00-21:00',
    isProbation: false,
    probationEnd: null,
    weeklyMisses: 0,
    passMinutes: 47,
  },
};
