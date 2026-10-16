import type { LobbyResponse } from '@/lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWebApp = any;

const getWebApp = (): AnyWebApp | undefined =>
  typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined;

export function isInsideTelegram(): boolean {
  return Boolean(getWebApp());
}

export interface TgUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

/** The signed-in Telegram user (unverified — the server re-checks init data). */
export function currentUser(): TgUser | null {
  const user = getWebApp()?.initDataUnsafe?.user;
  if (!user?.id) return null;
  return {
    id: Number(user.id),
    firstName: String(user.first_name ?? 'بازیکن'),
    lastName: user.last_name ? String(user.last_name) : undefined,
    username: user.username ? String(user.username) : undefined,
  };
}

export function displayName(): string {
  const user = currentUser();
  if (!user) return 'بازیکن';
  return user.firstName + (user.lastName ? ` ${user.lastName}` : '');
}

/** The `startapp` parameter the Mini App was opened with, if any. */
export function startParam(): string | null {
  const raw = getWebApp()?.initDataUnsafe?.start_param;
  if (!raw) return null;
  return String(raw);
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'select'): void {
  const feedback = getWebApp()?.HapticFeedback;
  if (!feedback) return;
  if (type === 'success' || type === 'error' || type === 'select') {
    feedback.notificationOccurred?.(type);
  } else {
    feedback.impactOccurred?.(type);
  }
}

export function openLink(url: string): void {
  const webApp = getWebApp();
  if (webApp?.openLink) {
    webApp.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

export function shareUrl(url: string, text: string): void {
  const webApp = getWebApp();
  const target = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(target);
    return;
  }
  window.open(target, '_blank', 'noopener');
}

export function initTelegram(): void {
  const webApp = getWebApp();
  if (!webApp) return;
  webApp.ready?.();
  webApp.expand?.();
  webApp.setHeaderColor?.('#06342a');
  webApp.setBackgroundColor?.('#06342a');
}

/**
 * Call a bot endpoint.
 *
 * Inside Telegram this uses the official `Telegram.WebApp.Serverless.call`,
 * which attaches the (platform-verified) init data. Outside Telegram — the
 * local dev server — it falls back to an in-browser mock so the game can be
 * played without the bot.
 */
export async function callEndpoint<T>(name: string, input: unknown): Promise<T> {
  const webApp = getWebApp();

  if (webApp?.Serverless?.call) {
    return new Promise<T>((resolve, reject) => {
      webApp.Serverless.call(name, input, (err: any, result: any) => {
        if (err) {
          reject(new Error(err?.message || 'ارتباط با سرور برقرار نشد'));
          return;
        }
        resolve(result as T);
      });
    });
  }

  const { mockCall } = await import('@/lib/mock-server');
  return mockCall<T>(name, input);
}

/** Convenience wrappers around the bot endpoints. */
export const api = {
  lobby: () => callEndpoint<LobbyResponse>('getLobby', {}),
  createGame: (mode: 'solo' | 'room') => callEndpoint<import('@/lib/types').GameResponse>('createGame', { mode }),
  getGame: (gameId: string) => callEndpoint<import('@/lib/types').GameResponse>('getGame', { gameId }),
  joinGame: (code: string) => callEndpoint<import('@/lib/types').GameResponse>('joinGame', { code }),
  chooseTrump: (gameId: string, trump: string) =>
    callEndpoint<import('@/lib/types').GameResponse>('chooseTrump', { gameId, trump }),
  playCard: (gameId: string, card: string) =>
    callEndpoint<import('@/lib/types').GameResponse>('playCard', { gameId, card }),
  fillBots: (gameId: string) => callEndpoint<import('@/lib/types').GameResponse>('fillBots', { gameId }),
};
