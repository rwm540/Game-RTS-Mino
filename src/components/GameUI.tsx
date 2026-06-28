/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import React, { useState } from 'react';
import { translations, Language } from '../utils/translations';
import { UnitType, BuildingType, Unit, Building, Difficulty, ResourceType } from '../types';
import { sound } from '../utils/audio';
import { 
  Coins, Play, ShieldAlert, Volume2, VolumeX, Menu, Crosshair, 
  Sparkles, Hammer, ShieldCheck, Users, HelpCircle, Swords, MapPin,
  TreePine, Gem, Wrench, Flame, Droplet, Shield, Zap, HeartHandshake
} from 'lucide-react';

interface GameUIProps {
  language: Language;
  minerals: number;
  selectedUnits: Unit[];
  selectedBuilding: Building | null;
  touchMode: 'SELECT' | 'PAN';
  setTouchMode: (mode: 'SELECT' | 'PAN') => void;
  onSelectAllCombat: () => void;
  onSelectAllWorkers: () => void;
  onClearSelection: () => void;
  onBuildSelect: (type: BuildingType) => void;
  onTrainUnit: (type: UnitType) => void;
  onBackToMenu: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isPlacingBuilding: BuildingType | null;
  cancelBuildingPlacement: () => void;
  underAttackAlert: boolean;
  enemyAttackTimer: number; // in seconds
  difficulty: Difficulty;
  upgrades: {
    fastGather: boolean;
    speedBoost: boolean;
  };
  onBuyUpgrade: (type: 'fastGather' | 'speedBoost') => void;
  currentPopulation: number;
  maxPopulation: number;
  errorMessage: string | null;
  onClearErrorMessage: () => void;
  
  // Custom RTS variables
  resources: {
    wood: number;
    gold: number;
    stone: number;
    iron: number;
    coal: number;
    oil: number;
    weapons: number;
    ammo: number;
  };
  factions: Array<{
    id: string;
    name: string;
    leader: string;
    avatar: string;
    relation: number;
    status: 'ALLY' | 'NEUTRAL' | 'WAR';
    castleX: number;
    castleY: number;
  }>;
  workerAssignments: {
    GOLD: number;
    WOOD: number;
    STONE: number;
    IRON: number;
    COAL: number;
    OIL: number;
  };
  onUpdateWorkerAssignments: (assignments: {
    GOLD: number;
    WOOD: number;
    STONE: number;
    IRON: number;
    COAL: number;
    OIL: number;
  }) => void;
  onUpdateRelation: (factionId: string, delta: number) => void;
}

export default function GameUI({
  language,
  minerals,
  selectedUnits,
  selectedBuilding,
  touchMode,
  setTouchMode,
  onSelectAllCombat,
  onSelectAllWorkers,
  onClearSelection,
  onBuildSelect,
  onTrainUnit,
  onBackToMenu,
  soundEnabled,
  onToggleSound,
  isPlacingBuilding,
  cancelBuildingPlacement,
  underAttackAlert,
  enemyAttackTimer,
  difficulty,
  upgrades,
  onBuyUpgrade,
  currentPopulation,
  maxPopulation,
  errorMessage,
  onClearErrorMessage,
  
  // Custom props
  resources,
  factions,
  workerAssignments,
  onUpdateWorkerAssignments,
  onUpdateRelation,
}: GameUIProps) {
  const t = translations[language];
  const [showDiplomacy, setShowDiplomacy] = useState(false);

  // Group selected units by type
  const workersSelected = selectedUnits.filter(u => u.type === UnitType.WORKER);
  const soldiersSelected = selectedUnits.filter(u => u.type === UnitType.SOLDIER);
  const heavySelected = selectedUnits.filter(u => u.type === UnitType.HEAVY);

  const hasWorkersSelected = workersSelected.length > 0;

  return (
    <div id="game-ui-overlay" className="absolute inset-0 pointer-events-none flex flex-col justify-between font-sans text-slate-100 z-20 select-none">
      
      {/* 1. TOP BAR (Tactical Resource Bar from Immersive UI) */}
      <header className="min-h-14 bg-black/85 border-b border-cyan-500/30 flex flex-wrap items-center justify-between px-4 md:px-6 z-20 pointer-events-auto gap-4 py-2">
        {/* Left Side: Resource Markers with icons and responsive wrapping */}
        <div className="flex flex-wrap items-center gap-3 md:gap-5">
          {/* Gold */}
          <div className="flex items-center space-x-1.5 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded" title="Gold / طلا">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold tracking-tight text-amber-200 font-mono">
              {resources.gold}
            </span>
          </div>

          {/* Wood */}
          <div className="flex items-center space-x-1.5 bg-green-950/40 border border-green-500/20 px-2 py-0.5 rounded" title="Wood / چوب">
            <TreePine className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-bold tracking-tight text-green-200 font-mono">
              {resources.wood}
            </span>
          </div>

          {/* Stone */}
          <div className="flex items-center space-x-1.5 bg-slate-800/40 border border-slate-500/20 px-2 py-0.5 rounded" title="Stone / سنگ">
            <Gem className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold tracking-tight text-slate-200 font-mono">
              {resources.stone}
            </span>
          </div>

          {/* Iron */}
          <div className="flex items-center space-x-1.5 bg-yellow-950/40 border border-yellow-600/20 px-2 py-0.5 rounded" title="Iron / آهن">
            <Wrench className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-bold tracking-tight text-yellow-200 font-mono">
              {resources.iron}
            </span>
          </div>

          {/* Coal */}
          <div className="flex items-center space-x-1.5 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded" title="Coal / زغال سنگ">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-bold tracking-tight text-zinc-300 font-mono">
              {resources.coal}
            </span>
          </div>

          {/* Oil */}
          <div className="flex items-center space-x-1.5 bg-sky-950/40 border border-sky-500/20 px-2 py-0.5 rounded" title="Oil / نفت">
            <Droplet className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-bold tracking-tight text-sky-200 font-mono">
              {resources.oil}
            </span>
          </div>

          {/* Weapons */}
          <div className="flex items-center space-x-1.5 bg-red-950/40 border border-red-500/20 px-2 py-0.5 rounded" title="Weapons / تسلیحات">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-bold tracking-tight text-red-200 font-mono">
              {resources.weapons}
            </span>
          </div>

          {/* Ammo */}
          <div className="flex items-center space-x-1.5 bg-blue-950/40 border border-blue-500/20 px-2 py-0.5 rounded" title="Ammo / مهمات">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold tracking-tight text-blue-200 font-mono">
              {resources.ammo}
            </span>
          </div>

          {/* Wave Timer */}
          <div className="flex items-center space-x-1.5 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
            <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="text-[11px] font-black tracking-widest text-cyan-200 font-mono">
              WAVE: {enemyAttackTimer}s
            </span>
          </div>

          {/* Population */}
          <div className="flex items-center space-x-1.5 bg-teal-950/40 border border-teal-500/20 px-2 py-0.5 rounded">
            <Users className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[11px] font-black tracking-widest text-teal-200 font-mono uppercase">
              {currentPopulation} / {maxPopulation}
            </span>
          </div>
        </div>

        {/* Center: Under Attack Alarm */}
        {underAttackAlert && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.05, 1], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="bg-red-950/90 border border-red-500/50 text-red-200 px-3 py-1 rounded shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-2 backdrop-blur-sm"
          >
            <ShieldAlert className="w-4 h-4 text-red-500 animate-bounce" />
            <div className="text-left">
              <span className="text-[10px] font-black tracking-wider block">{t.underAttack}</span>
            </div>
          </motion.div>
        )}

        {/* Right Side: Options & Toggles in futuristic tactical badges */}
        <div className="flex items-center space-x-3">
          {/* Diplomacy Button */}
          <button
            id="ui-diplomacy-btn"
            onClick={() => {
              setShowDiplomacy(true);
              sound.playSelect();
            }}
            className="px-3 py-1 bg-cyan-950/50 border border-cyan-500/40 text-cyan-400 rounded text-[11px] font-black tracking-widest transition-all cursor-pointer hover:bg-cyan-500 hover:text-slate-950 flex items-center gap-1"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            دیپلماسی / Diplomacy
          </button>

          <button
            id="ui-sound-toggle"
            onClick={onToggleSound}
            className={`px-3 py-1 bg-slate-800/40 border border-slate-700/60 rounded text-[11px] font-bold tracking-widest transition-all cursor-pointer hover:border-cyan-400 ${
              soundEnabled ? 'text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.2)]' : 'text-slate-500'
            }`}
          >
            {soundEnabled ? 'AUDIO: ON' : 'AUDIO: OFF'}
          </button>
          
          <button
            id="ui-back-to-menu"
            onClick={onBackToMenu}
            className="px-3 py-1 bg-slate-900 border border-rose-900/60 hover:border-rose-500 text-rose-400 rounded text-[11px] font-bold tracking-widest transition-all cursor-pointer"
          >
            {t.backToMenu.toUpperCase()}
          </button>
        </div>
      </header>

      {/* Floating Worker Assignment Panel (Middle Left) */}
      <div className="absolute left-4 top-20 pointer-events-auto flex flex-col gap-2 z-10">
        <div className="bg-slate-950/90 border border-cyan-500/30 rounded-lg p-3 w-56 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="text-[11px] font-black text-cyan-400 uppercase tracking-wider">تخصیص کارگران / Worker Allocation</span>
            <Users className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          
          <div className="space-y-2">
            {(['GOLD', 'WOOD', 'STONE', 'IRON', 'COAL', 'OIL'] as const).map(role => {
              const count = workerAssignments[role] || 0;
              const totalAllocated = Object.values(workerAssignments).reduce((a, b) => a + b, 0);
              const maxAvailableWorkers = workersSelected.length || currentPopulation; // Use selected workers or current population count as cap
              
              const increment = () => {
                sound.playSelect();
                const updated = { ...workerAssignments };
                updated[role]++;
                onUpdateWorkerAssignments(updated);
              };

              const decrement = () => {
                if (count > 0) {
                  sound.playSelect();
                  const updated = { ...workerAssignments };
                  updated[role]--;
                  onUpdateWorkerAssignments(updated);
                }
              };

              return (
                <div key={role} className="flex items-center justify-between text-xs font-mono bg-black/40 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-300 font-bold tracking-wider flex items-center gap-1.5">
                    {role === 'GOLD' && <Coins className="w-3 h-3 text-amber-400" />}
                    {role === 'WOOD' && <TreePine className="w-3 h-3 text-green-400" />}
                    {role === 'STONE' && <Gem className="w-3 h-3 text-slate-400" />}
                    {role === 'IRON' && <Wrench className="w-3 h-3 text-yellow-500" />}
                    {role === 'COAL' && <Flame className="w-3 h-3 text-orange-400" />}
                    {role === 'OIL' && <Droplet className="w-3 h-3 text-sky-400" />}
                    {role}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={decrement}
                      disabled={count === 0}
                      className="w-5 h-5 bg-slate-900 border border-slate-800 hover:border-cyan-500 disabled:opacity-30 disabled:pointer-events-none rounded flex items-center justify-center text-slate-300 hover:text-white transition-all text-xs font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-cyan-300 font-bold">{count}</span>
                    <button 
                      onClick={increment}
                      className="w-5 h-5 bg-slate-900 border border-slate-800 hover:border-cyan-500 rounded flex items-center justify-center text-slate-300 hover:text-white transition-all text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive Tactical Diplomacy Modal */}
      {showDiplomacy && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl bg-slate-950 border-2 border-cyan-500/40 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.3)]"
          >
            {/* Header */}
            <div className="bg-cyan-950/40 border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake className="text-cyan-400 w-5 h-5" />
                <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">شورای عالی دیپلماسی قلعه‌ها / Castle Alliance Council</h2>
              </div>
              <button 
                onClick={() => {
                  setShowDiplomacy(false);
                  sound.playSelect();
                }}
                className="text-slate-400 hover:text-white text-lg font-mono cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* List of Factions */}
            <div className="p-6 overflow-y-auto max-h-[450px] space-y-3 font-mono">
              {factions.filter(f => f.id !== 'player').map(f => {
                const isWar = f.status === 'WAR';
                const isAlly = f.status === 'ALLY';
                
                const tributeCost = 150;
                const peaceCostGold = 300;
                const peaceCostWeapons = 5;

                const canAffordTribute = resources.gold >= tributeCost;
                const canAffordPeace = resources.gold >= peaceCostGold && resources.weapons >= peaceCostWeapons;

                const sendTribute = () => {
                  if (canAffordTribute) {
                    resources.gold -= tributeCost;
                    onUpdateRelation(f.id, 15);
                    sound.playBuildComplete();
                  }
                };

                const declarePeace = () => {
                  if (canAffordPeace) {
                    resources.gold -= peaceCostGold;
                    resources.weapons -= peaceCostWeapons;
                    // Sign peace agreement set relation to 75 (ALLY)
                    onUpdateRelation(f.id, 75 - f.relation);
                    sound.playBuildComplete();
                  }
                };

                const declareWarAction = () => {
                  // Set relation to 0 (WAR)
                  onUpdateRelation(f.id, -f.relation);
                  sound.playAlarm();
                };

                return (
                  <div key={f.id} className="bg-black/50 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all">
                    {/* Faction identity */}
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-1 bg-slate-900 border border-slate-800 rounded-md shadow-md">{f.avatar}</span>
                      <div className="text-left">
                        <h4 className="text-sm font-bold text-slate-100">{f.name}</h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">// رهبر: {f.leader}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">رابطه:</span>
                          <div className="w-16 h-2 bg-slate-900 rounded overflow-hidden border border-slate-800">
                            <div 
                              className={`h-full rounded transition-all duration-500 ${
                                isWar ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : isAlly ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${f.relation}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${
                            isWar ? 'text-red-400' : isAlly ? 'text-emerald-400' : 'text-yellow-400'
                          }`}>
                            {f.relation}% ({f.status})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Send Tribute */}
                      <button
                        onClick={sendTribute}
                        disabled={!canAffordTribute || isAlly}
                        className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-[10px] uppercase font-bold rounded disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        title={`Offer tribute of ${tributeCost} gold to increase relation by +15`}
                      >
                        باج دادن (-{tributeCost} طلا)
                      </button>

                      {/* Peace Pact */}
                      {!isAlly && (
                        <button
                          onClick={declarePeace}
                          disabled={!canAffordPeace}
                          className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[10px] uppercase font-bold rounded disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                          title={`Declare Alliance: costs ${peaceCostGold} Gold, ${peaceCostWeapons} Weapons`}
                        >
                          صلح و اتحاد
                        </button>
                      )}

                      {/* Declare War */}
                      {!isWar && (
                        <button
                          onClick={declareWarAction}
                          className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/65 border border-red-500/40 text-red-300 hover:text-white text-[10px] uppercase font-bold rounded transition-all cursor-pointer"
                        >
                          اعلان جنگ!
                        </button>
                      )}

                      {/* Status indicator */}
                      {isAlly && (
                        <span className="px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded animate-pulse">
                          متحد رسمی / ACTIVE ALLY
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* 1.5 CYBER TOAST NOTIFICATION OVERLAY */}
      {errorMessage && (
        <motion.div
          id="cyber-toast"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-950/95 border-2 border-red-500 text-red-200 px-5 py-3 rounded-lg shadow-[0_0_25px_rgba(239,68,68,0.5)] z-50 pointer-events-auto flex items-center gap-3 backdrop-blur-md max-w-md"
        >
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <p className="text-xs font-mono font-bold uppercase tracking-wider">{errorMessage}</p>
          <button 
            onClick={onClearErrorMessage}
            className="ml-2 text-red-400 hover:text-white font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* 2. MID SCREEN PLACEMENT HINT */}
      {isPlacingBuilding && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-teal-950/90 border border-teal-500/50 rounded-xl px-4 py-2.5 shadow-2xl pointer-events-auto flex flex-col items-center gap-1 text-center max-w-sm backdrop-blur-md">
          <p className="text-xs font-bold text-teal-300">
            {t.buildPlacementHint} ({isPlacingBuilding === BuildingType.BARRACKS ? t.barracks : t.turret})
          </p>
          <button
            id="cancel-placement-btn"
            onClick={cancelBuildingPlacement}
            className="text-[10px] font-mono text-rose-400 border border-rose-900/50 bg-rose-950/40 px-2 py-0.5 rounded-md hover:bg-rose-950 transition-colors"
          >
            [ Cancel / لغو ساخت ]
          </button>
        </div>
      )}

      {/* 3. SIDE DOCK / COMMAND PANEL (Displays active selection specs) */}
      <div className="w-full flex flex-col md:flex-row justify-between items-end gap-3 mt-auto p-4 md:p-6 bg-slate-950/90 border-t border-cyan-500/20 backdrop-blur-md pointer-events-auto">
        
        {/* Left Control Dock: Selection Status and Building / Train Menus */}
        <div className="flex flex-col gap-2 w-full md:w-80">
          
          {/* Selected Building Details */}
          {selectedBuilding && (
            <div className="bg-black/60 border border-slate-800 border-l-2 border-l-cyan-400 rounded p-3 shadow-[0_0_10px_rgba(6,182,212,0.1)] flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                  <p className="text-xs font-black tracking-widest uppercase text-slate-100">
                    {selectedBuilding.type === BuildingType.COMMAND_CENTER ? t.cc : selectedBuilding.type === BuildingType.BARRACKS ? t.barracks : t.turret}
                  </p>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">
                  {selectedBuilding.hp}/{selectedBuilding.maxHp} HP
                </span>
              </div>

              {/* Building not complete progress */}
              {!selectedBuilding.isComplete && (
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{t.progress}: {Math.floor(selectedBuilding.buildProgress)}%</p>
                  <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full" style={{ width: `${selectedBuilding.buildProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Training controls if complete */}
              {selectedBuilding.isComplete && (
                <div className="flex flex-col gap-2">
                  {selectedBuilding.type === BuildingType.COMMAND_CENTER && (
                    <button
                      id="train-worker-btn"
                      onClick={() => onTrainUnit(UnitType.WORKER)}
                      className="w-full py-2 px-3 bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 rounded text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 uppercase tracking-wide">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        {t.worker}
                      </span>
                      <span className="text-amber-400 font-mono text-[10px] font-black">50 🪙</span>
                    </button>
                  )}

                  {selectedBuilding.type === BuildingType.BARRACKS && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="train-soldier-btn"
                        onClick={() => onTrainUnit(UnitType.SOLDIER)}
                        className="py-2 px-2 bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 rounded text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1 uppercase tracking-wide">
                          <Swords className="w-3.5 h-3.5 text-cyan-400" />
                          {t.soldier}
                        </span>
                        <span className="text-amber-400 font-mono text-[10px] font-black">100 🪙</span>
                      </button>
                      
                      <button
                        id="train-heavy-btn"
                        onClick={() => onTrainUnit(UnitType.HEAVY)}
                        className="py-2 px-2 bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 rounded text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1 uppercase tracking-wide">
                          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                          {t.heavy}
                        </span>
                        <span className="text-amber-400 font-mono text-[10px] font-black">250 🪙</span>
                      </button>
                    </div>
                  )}

                  {/* Show Queue progress */}
                  {selectedBuilding.productionQueue.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-800/80 pt-2 mt-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-tighter">
                        <span>{t.queue}: {selectedBuilding.productionQueue.length}/5</span>
                        <span className="text-cyan-400 font-mono">{Math.floor(selectedBuilding.productionProgress)}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full animate-pulse" style={{ width: `${selectedBuilding.productionProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active selection and construct structures buttons */}
          {selectedUnits.length > 0 && (
            <div className="bg-black/60 border border-slate-800 border-l-2 border-l-cyan-400 rounded p-3 shadow-[0_0_10px_rgba(6,182,212,0.1)] flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1">
                <p className="text-xs font-black uppercase tracking-wider text-slate-300">
                  {selectedUnits.length} {t.units}
                </p>
                <button
                  id="clear-select-btn"
                  onClick={onClearSelection}
                  className="text-[9px] font-bold text-slate-400 hover:text-slate-100 border border-slate-800 hover:border-cyan-500 bg-slate-900/60 px-2 py-0.5 rounded transition-all cursor-pointer"
                >
                  {t.clearSelection.toUpperCase()}
                </button>
              </div>

              {/* Selection composition counts */}
              <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
                {workersSelected.length > 0 && (
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1">
                    🛠️ {workersSelected.length} {t.worker}
                  </span>
                )}
                {soldiersSelected.length > 0 && (
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1">
                    🔫 {soldiersSelected.length} {t.soldier}
                  </span>
                )}
                {heavySelected.length > 0 && (
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1">
                    🛡️ {heavySelected.length} {t.heavy}
                  </span>
                )}
              </div>

              {/* Build Actions (If workers selected, show building construction tools!) */}
              {hasWorkersSelected && (
                <div className="space-y-2 border-t border-slate-800/80 pt-2 mt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                    <Hammer className="w-3 h-3" />
                    {t.structures}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="build-cc-btn"
                      onClick={() => onBuildSelect(BuildingType.COMMAND_CENTER)}
                      className="py-1.5 px-2 bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 rounded text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer"
                    >
                      <span className="uppercase tracking-wide text-center">+ {t.cc}</span>
                      <span className="text-amber-400 font-mono text-[9px] font-black">400 🪙</span>
                    </button>

                    <button
                      id="build-house-btn"
                      onClick={() => onBuildSelect(BuildingType.HOUSE)}
                      className="py-1.5 px-2 bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 rounded text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer"
                    >
                      <span className="uppercase tracking-wide text-center">+ {t.house}</span>
                      <span className="text-amber-400 font-mono text-[9px] font-black">75 🪙</span>
                    </button>

                    <button
                      id="build-barracks-btn"
                      onClick={() => onBuildSelect(BuildingType.BARRACKS)}
                      className="py-1.5 px-2 bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 rounded text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer"
                    >
                      <span className="uppercase tracking-wide text-center">+ {t.barracks}</span>
                      <span className="text-amber-400 font-mono text-[9px] font-black">150 🪙</span>
                    </button>
                    
                    <button
                      id="build-turret-btn"
                      onClick={() => onBuildSelect(BuildingType.TURRET)}
                      className="py-1.5 px-2 bg-slate-800/40 border border-slate-700/60 hover:border-rose-400 rounded text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer"
                    >
                      <span className="uppercase tracking-wide text-center">+ {t.turret}</span>
                      <span className="text-amber-400 font-mono text-[9px] font-black">125 🪙</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upgrades panel if player has spare minerals */}
          <div className="bg-black/60 border border-slate-800 border-l-2 border-l-cyan-400 rounded p-3 shadow-[0_0_10px_rgba(6,182,212,0.1)] flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1 border-b border-slate-800/80 pb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {t.upgrades}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="upgrade-gather-btn"
                disabled={upgrades.fastGather}
                onClick={() => onBuyUpgrade('fastGather')}
                className={`py-1.5 px-1.5 rounded text-[10px] font-bold transition-all flex flex-col items-center justify-between text-center cursor-pointer ${
                  upgrades.fastGather 
                    ? 'bg-slate-900 text-slate-500 border border-slate-800/40' 
                    : 'bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 text-slate-200'
                }`}
              >
                <span className="uppercase tracking-tighter">{t.fastGather}</span>
                <span className="text-amber-400 font-mono text-[9px] font-black mt-0.5">
                  {upgrades.fastGather ? '✔ MAX' : '150 🪙'}
                </span>
              </button>

              <button
                id="upgrade-speed-btn"
                disabled={upgrades.speedBoost}
                onClick={() => onBuyUpgrade('speedBoost')}
                className={`py-1.5 px-1.5 rounded text-[10px] font-bold transition-all flex flex-col items-center justify-between text-center cursor-pointer ${
                  upgrades.speedBoost 
                    ? 'bg-slate-900 text-slate-500 border border-slate-800/40' 
                    : 'bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 text-slate-200'
                }`}
              >
                <span className="uppercase tracking-tighter">{t.speedBoost}</span>
                <span className="text-amber-400 font-mono text-[9px] font-black mt-0.5">
                  {upgrades.speedBoost ? '✔ MAX' : '200 🪙'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Control Dock: Mobile Touch Helpers & Selection controls */}
        <div className="flex flex-col gap-2 items-stretch md:items-end">
          
          {/* Touch Select Toggle Mode */}
          <div className="bg-black/40 border border-slate-800/80 rounded p-1.5 shadow flex items-center justify-between md:justify-end gap-2">
            <span className="text-[10px] font-black tracking-widest text-slate-400 px-1 font-mono">
              MODE:
            </span>
            <div className="flex gap-1.5">
              <button
                id="touch-mode-select-btn"
                onClick={() => {
                  setTouchMode('SELECT');
                  sound.playSelect();
                }}
                className={`text-[11px] px-3 py-1.5 rounded font-black tracking-wider transition-all cursor-pointer ${
                  touchMode === 'SELECT'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.boxSelect.toUpperCase()}
              </button>
              
              <button
                id="touch-mode-pan-btn"
                onClick={() => {
                  setTouchMode('PAN');
                  sound.playSelect();
                }}
                className={`text-[11px] px-3 py-1.5 rounded font-black tracking-wider transition-all cursor-pointer ${
                  touchMode === 'PAN'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.panMap.toUpperCase()}
              </button>
            </div>
          </div>

          {/* Quick selectors row */}
          <div className="bg-black/40 border border-slate-800/80 rounded p-2 shadow flex flex-col gap-1.5 w-full md:w-60">
            <button
              id="select-combat-troops-btn"
              onClick={onSelectAllCombat}
              className="py-2 px-3 text-[11px] font-bold tracking-wider uppercase bg-slate-900/60 border border-slate-800 hover:border-cyan-400 hover:bg-slate-800/80 rounded text-left flex items-center justify-between text-slate-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-rose-500" />
                {t.selectAllCombat}
              </span>
            </button>
            
            <button
              id="select-workers-btn"
              onClick={onSelectAllWorkers}
              className="py-2 px-3 text-[11px] font-bold tracking-wider uppercase bg-slate-900/60 border border-slate-800 hover:border-cyan-400 hover:bg-slate-800/80 rounded text-left flex items-center justify-between text-slate-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Hammer className="w-3.5 h-3.5 text-cyan-400" />
                {t.selectAllWorkers}
              </span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
