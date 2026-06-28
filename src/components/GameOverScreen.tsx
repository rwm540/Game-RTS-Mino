/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { translations, Language } from '../utils/translations';
import { GameStats } from '../types';
import { Award, RefreshCw, LogOut, ShieldAlert, TrendingUp } from 'lucide-react';

interface GameOverScreenProps {
  victory: boolean;
  stats: GameStats;
  language: Language;
  onRestart: () => void;
  onBackToMenu: () => void;
}

export default function GameOverScreen({ victory, stats, language, onRestart, onBackToMenu }: GameOverScreenProps) {
  const t = translations[language];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const statItems = [
    { label: t.statsMined, value: stats.mineralsMined, color: 'text-amber-400' },
    { label: t.statsTrained, value: stats.unitsTrained, color: 'text-emerald-400' },
    { label: t.statsLost, value: stats.unitsLost, color: 'text-rose-400' },
    { label: t.statsKilled, value: stats.unitsKilled, color: 'text-sky-400' },
    { label: t.statsBuilt, value: stats.buildingsBuilt, color: 'text-purple-400' },
    { label: t.statsDestroyed, value: stats.buildingsDestroyed, color: 'text-red-400' },
  ];

  return (
    <div 
      id="game-over-screen"
      className="w-full h-full bg-slate-950 text-slate-100 flex flex-col items-center p-4 font-sans overflow-y-auto relative scroll-smooth"
    >
      {/* Grid Pattern Layer */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full max-w-xl border-4 border-slate-900 p-6 md:p-8 bg-slate-950 relative overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.8)] my-auto ${
          victory 
            ? 'shadow-emerald-500/10 border-emerald-950' 
            : 'shadow-rose-500/10 border-rose-950'
        }`}
      >
        {/* Glow behind */}
        <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-15 ${
          victory ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />

        {/* Decorative corner lines */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-500/60"></div>
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-500/60"></div>
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-500/60"></div>
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-500/60"></div>

        <div className="flex flex-col items-center text-center relative z-10">
          {/* Main Icon */}
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`p-4 border mb-6 ${
              victory ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
            }`}
          >
            {victory ? <Award className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
          </motion.div>

          {/* Heading */}
          <h1 className={`text-3xl md:text-5xl font-black tracking-tight mb-3 font-display uppercase ${
            victory ? 'text-emerald-400 text-glow-emerald' : 'text-rose-400 text-glow-rose'
          }`}>
            {victory ? t.victory : t.defeat}
          </h1>

          <p className="text-slate-400 text-xs md:text-sm tracking-wide uppercase font-mono max-w-md mb-8">
            {victory ? t.victoryDesc : t.defeatDesc}
          </p>

          {/* Duration info */}
          <div className="bg-black/60 border border-slate-800/80 px-4 py-2 rounded text-xs font-mono text-slate-400 mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="tracking-widest">TACTICAL TIME: {formatDuration(stats.gameDuration)}</span>
          </div>

          {/* Battle Statistics Grid */}
          <h2 className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-4 font-mono">
            // {t.winStats.toUpperCase()}
          </h2>

          <div className="grid grid-cols-2 gap-3 w-full mb-8 font-mono">
            {statItems.map((item, index) => (
              <div 
                key={index} 
                className="bg-black/40 border border-slate-800/60 p-3 flex flex-col justify-between items-center text-center"
              >
                <span className="text-[10px] text-slate-500 mb-1 uppercase tracking-tighter">{item.label}</span>
                <span className={`text-lg font-black ${item.color}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full font-mono">
            <motion.button
              id="restart-battle-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onRestart}
              className="py-3 px-6 bg-cyan-500 text-slate-950 font-black text-sm tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer border border-cyan-400"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.playAgain.toUpperCase()}</span>
            </motion.button>

            <motion.button
              id="back-to-menu-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBackToMenu}
              className="py-3 px-6 bg-slate-900 border border-slate-800 hover:border-rose-500 text-slate-300 font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.backToMenu.toUpperCase()}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
