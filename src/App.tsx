import { useEffect, useState } from 'react';

import { GameView } from './components/GameView';
import { Lobby } from './components/Lobby';
import { api, initTelegram, startParam } from './helpers/telegram';

type Screen = { name: 'loading' } | { name: 'lobby' } | { name: 'game'; gameId: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });

  useEffect(() => {
    initTelegram();

    const param = startParam();

    if (!param) {
      setScreen({ name: 'lobby' });
      return;
    }

    if (param.startsWith('g_')) {
      setScreen({ name: 'game', gameId: param.slice(2) });
      return;
    }

    if (param.startsWith('join_')) {
      const code = param.slice(5);
      api
        .joinGame(code)
        .then((response) => setScreen({ name: 'game', gameId: response.game.id }))
        .catch(() => setScreen({ name: 'lobby' }));
      return;
    }

    setScreen({ name: 'lobby' });
  }, []);

  // The Telegram back button leaves the game and returns to the lobby.
  useEffect(() => {
    const webApp = (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp;
    if (!webApp?.BackButton) return;

    if (screen.name === 'game') {
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => setScreen({ name: 'lobby' }));
    } else {
      webApp.BackButton.hide();
    }

    return () => webApp.BackButton?.hide?.();
  }, [screen.name]);

  if (screen.name === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-gold-300/30 border-t-gold-300" />
          <p className="text-sm text-white/60">در حال آماده‌سازی میز…</p>
        </div>
      </div>
    );
  }

  if (screen.name === 'game') {
    return (
      <GameView
        gameId={screen.gameId}
        onExit={() => setScreen({ name: 'lobby' })}
        onOpenGame={(gameId) => setScreen({ name: 'game', gameId })}
      />
    );
  }

  return <Lobby onOpenGame={(gameId) => setScreen({ name: 'game', gameId })} />;
}
