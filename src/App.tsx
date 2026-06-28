/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Difficulty, GameStats } from './types';
import StartScreen from './components/StartScreen';
import GameCanvas from './components/GameCanvas';
import GameOverScreen from './components/GameOverScreen';
import { Language } from './utils/translations';
import { sound } from './utils/audio';

export default function App() {
  const [screen, setScreen] = useState<'MENU' | 'PLAYING' | 'GAMEOVER'>('MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [language, setLanguage] = useState<Language>('fa');
  const [victory, setVictory] = useState<boolean>(false);
  const [gameStats, setGameStats] = useState<GameStats>({
    mineralsMined: 0,
    unitsTrained: 0,
    unitsLost: 0,
    unitsKilled: 0,
    buildingsBuilt: 0,
    buildingsDestroyed: 0,
    gameDuration: 0,
  });

  const handleStartGame = (diff: Difficulty, lang: Language) => {
    setDifficulty(diff);
    setLanguage(lang);
    setScreen('PLAYING');
  };

  const handleGameOver = (isVictory: boolean, stats: GameStats) => {
    setVictory(isVictory);
    setGameStats(stats);
    setScreen('GAMEOVER');
    if (isVictory) {
      sound.playVictory();
    } else {
      sound.playDefeat();
    }
  };

  const handleRestart = () => {
    sound.playSelect();
    setScreen('PLAYING');
  };

  const handleBackToMenu = () => {
    sound.playSelect();
    setScreen('MENU');
  };

  return (
    <div id="rts-app" className="w-screen h-screen bg-slate-950 overflow-hidden">
      {screen === 'MENU' && (
        <StartScreen onStart={handleStartGame} />
      )}
      {screen === 'PLAYING' && (
        <GameCanvas
          difficulty={difficulty}
          language={language}
          onGameOver={handleGameOver}
          onBackToMenu={handleBackToMenu}
        />
      )}
      {screen === 'GAMEOVER' && (
        <GameOverScreen
          victory={victory}
          stats={gameStats}
          language={language}
          onRestart={handleRestart}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </div>
  );
}
