/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { translations, Language } from '../utils/translations';
import { Difficulty } from '../types';
import { sound } from '../utils/audio';
import { Shield, Swords, Info, Volume2, VolumeX, Globe, History, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StartScreenProps {
  onStart: (difficulty: Difficulty, language: Language) => void;
}

interface BattleLog {
  id: string;
  date: string;
  duration: number;
  mineralsMined: number;
  unitsTrained: number;
  unitsLost: number;
  unitsKilled: number;
  buildingsBuilt: number;
  victory: boolean;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [lang, setLang] = useState<Language>('fa');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [logs, setLogs] = useState<BattleLog[]>([]);

  useEffect(() => {
    try {
      const logsStr = localStorage.getItem('rts_battle_logs');
      if (logsStr) {
        setLogs(JSON.parse(logsStr));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const t = translations[lang];

  const handleStart = () => {
    sound.setEnabled(soundEnabled);
    if (soundEnabled) {
      sound.playBuildComplete();
    }
    onStart('MEDIUM', lang); // Default balanced difficulty
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    sound.setEnabled(newState);
    if (newState) {
      sound.playSelect();
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      id="start-screen"
      className="w-full h-full bg-slate-950 text-slate-100 flex flex-col items-center p-4 md:p-8 font-sans overflow-y-auto relative scroll-smooth"
    >
      {/* Grid Pattern Layer */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Cyberpunk ambient decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-cyan-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl z-10 flex flex-col items-center p-6 md:p-10 border-4 border-slate-900 bg-slate-950/95 relative shadow-[0_0_50px_rgba(0,0,0,0.8)] my-auto"
      >
        {/* Futuristic corner details */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/60"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/60"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/60"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/60"></div>

        {/* Quick Language & Sound Selectors */}
        <div className="w-full flex justify-between items-center mb-8 px-4 font-mono">
          <button
            id="lang-toggle-btn"
            onClick={() => {
              const next = lang === 'en' ? 'fa' : 'en';
              setLang(next);
              sound.playSelect();
            }}
            className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-slate-800 text-xs tracking-widest text-cyan-400 hover:border-cyan-400 hover:text-white transition-all cursor-pointer uppercase font-bold"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>{lang === 'en' ? 'فارسی (FA)' : 'ENGLISH (EN)'}</span>
          </button>

          <button
            id="sound-toggle-btn"
            onClick={toggleSound}
            className={`flex items-center gap-2 px-4 py-1.5 border text-xs tracking-widest transition-all font-bold cursor-pointer uppercase ${
              soundEnabled 
                ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-400 hover:border-cyan-400' 
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'AUDIO: ON' : 'AUDIO: OFF'}</span>
          </button>
        </div>

        {/* Title Block */}
        <div className="text-center mb-10 relative">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono uppercase tracking-widest mb-4 bg-cyan-950/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
          >
            <Swords className="w-3.5 h-3.5" />
            BATTLE COMMAND CONSOLE v2.8
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight font-display text-white uppercase text-glow-cyan mb-3">
            {t.title}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm uppercase tracking-widest font-mono max-w-xl mx-auto">
            // {t.subtitle}
          </p>
        </div>

        {/* Setup Board & Handbooks */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mb-8">
          {/* Settings Panel */}
          <div className="lg:col-span-12 bg-black/40 border border-slate-800/80 p-6 flex flex-col justify-between relative min-h-[350px]">
            <div className="w-full flex flex-col h-full justify-between">
              <div>
                <h2 className="text-sm font-black text-cyan-400 mb-4 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono uppercase tracking-widest">
                  <History className="w-4 h-4 text-cyan-400" />
                  {t.leakedLogs.toUpperCase()}
                </h2>

                <div className="space-y-2 mb-6 font-mono overflow-y-auto max-h-[220px] pr-1">
                  {logs.length === 0 ? (
                    <div className="text-slate-500 text-center py-10 border border-dashed border-slate-800/80 text-[10px] tracking-wider uppercase leading-relaxed">
                      // {t.noLogs}
                    </div>
                  ) : (
                    logs.slice(0, 4).map((log) => (
                      <div 
                        key={log.id} 
                        className={`p-2.5 border text-[10px] flex flex-col gap-1 transition-all ${
                          log.victory 
                            ? 'bg-emerald-950/15 border-emerald-900/50 hover:border-emerald-500/50' 
                            : 'bg-rose-950/15 border-rose-900/50 hover:border-rose-500/50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-bold flex items-center gap-1 uppercase tracking-widest ${
                            log.victory ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            {log.victory ? 'VICTORY' : 'DEFEAT'}
                          </span>
                          <span className="text-slate-500">{log.date}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-1 text-slate-400 pt-1 border-t border-slate-900">
                          <div>TIME: <span className="text-white font-bold">{formatDuration(log.duration)}</span></div>
                          <div>MINED: <span className="text-amber-400 font-bold">{log.mineralsMined}</span></div>
                          <div>KILLS: <span className="text-cyan-400 font-bold">{log.unitsKilled}</span></div>
                          <div>LOST: <span className="text-rose-400 font-bold">{log.unitsLost}</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <motion.button
                id="start-battle-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="w-full py-4 px-6 bg-cyan-500 text-slate-950 font-black text-sm tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:bg-cyan-400 transition-all flex items-center justify-center gap-2 cursor-pointer border border-cyan-300 mt-2"
              >
                <Swords className="w-4 h-4" />
                {t.startGame.toUpperCase()}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">
          // {t.credits}
        </p>
      </motion.div>
    </div>
  );
}
