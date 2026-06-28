/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { translations, Language } from '../utils/translations';
import { UnitType, BuildingType, Unit, Building, Difficulty, ResourceType } from '../types';
import { sound } from '../utils/audio';
import { INITIAL_CURRENCIES, calculateRate, getCommodityPrice, StateCurrency, ASSET_BASE_INDEX } from '../utils/economyHelpers';
import { 
  Coins, Play, ShieldAlert, Volume2, VolumeX, Menu, Crosshair, 
  Sparkles, Hammer, ShieldCheck, Users, HelpCircle, Swords, MapPin,
  TreePine, Gem, Wrench, Flame, Droplet, Shield, Zap, HeartHandshake,
  TrendingUp, Landmark, ArrowRightLeft, Minimize2, Maximize2, CircleDollarSign
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
  onUpdateResources: (newResources: {
    wood: number;
    gold: number;
    stone: number;
    iron: number;
    coal: number;
    oil: number;
    weapons: number;
    ammo: number;
  }) => void;
  buildings: Building[];
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
  onUpdateResources,
  buildings,
}: GameUIProps) {
  const t = translations[language];
  const [showDiplomacy, setShowDiplomacy] = useState(false);
  const [showWorkersPanel, setShowWorkersPanel] = useState(true);
  const [showEconomyDashboard, setShowEconomyDashboard] = useState(false);
  
  // Sovereign State Currencies State
  const [currencies, setCurrencies] = useState<{ [key: string]: StateCurrency }>(() => INITIAL_CURRENCIES);
  
  // Player Foreign Currency Balances (holds cash of each state)
  const [foreignBalances, setForeignBalances] = useState<{ [key: string]: number }>({
    player: 2500, // Starts with 2500 Rials Pars
    enemy: 0,
    f1: 0,
    f2: 0,
    f3: 0,
    f4: 0,
    f5: 0,
    f6: 0,
    f7: 0,
    f8: 0,
  });

  // Check if player has built a completed Minting Center
  const hasMintingCenter = buildings.some(b => b.player === 'PLAYER' && b.type === BuildingType.MINTING_CENTER && b.isComplete && b.hp > 0);

  // Background macroeconomic simulation ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrencies(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const curr = { ...next[key] };
          
          if (key === 'player') {
            // Player's backing amount is tied to actual real-time in-game resource counts!
            let backingAmount = 100;
            if (curr.backingResource === ResourceType.GOLD) backingAmount = resources.gold;
            else if (curr.backingResource === ResourceType.WOOD) backingAmount = resources.wood;
            else if (curr.backingResource === ResourceType.STONE) backingAmount = resources.stone;
            else if (curr.backingResource === ResourceType.IRON) backingAmount = resources.iron;
            else if (curr.backingResource === ResourceType.COAL) backingAmount = resources.coal;
            else if (curr.backingResource === ResourceType.OIL) backingAmount = resources.oil;
            
            curr.backingAmount = backingAmount + 50; // default baseline safety buffer
          } else {
            // Foreign states have slightly fluctuating backing reserves as they simulate mine operations
            const change = Math.floor(Math.random() * 6) - 2; // slight bias upwards
            curr.backingAmount = Math.max(80, curr.backingAmount + change);
            
            // Random dynamic AI printing/burning
            if (Math.random() > 0.8) {
              const isMinting = Math.random() > 0.45;
              if (isMinting) {
                curr.circulatingSupply = Math.min(60000, curr.circulatingSupply + Math.floor(Math.random() * 400));
              } else {
                curr.circulatingSupply = Math.max(800, curr.circulatingSupply - Math.floor(Math.random() * 200));
              }
            }
          }
          
          // Re-evaluate exchange rate based on the monetary formula
          curr.exchangeRate = calculateRate(curr);
          next[key] = curr;
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [resources]);

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
        {!showWorkersPanel ? (
          <button
            onClick={() => {
              setShowWorkersPanel(true);
              sound.playSelect();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/90 border border-cyan-500/40 text-cyan-400 rounded-lg hover:border-cyan-400 transition-all font-bold text-[10px] shadow-lg cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>مدیریت کارگران / Workers</span>
          </button>
        ) : (
          <div className="bg-slate-950/90 border border-cyan-500/30 rounded-lg p-3 w-56 backdrop-blur-md shadow-2xl relative">
            <button
              onClick={() => {
                setShowWorkersPanel(false);
                sound.playSelect();
              }}
              className="absolute top-2.5 right-2.5 text-slate-500 hover:text-cyan-400 transition-all cursor-pointer"
              title="Hide / پنهان کردن"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 pr-6">
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
                        className="w-5 h-5 bg-slate-900 border border-slate-800 hover:border-cyan-500 disabled:opacity-30 disabled:pointer-events-none rounded flex items-center justify-center text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-cyan-300 font-bold">{count}</span>
                      <button 
                        onClick={increment}
                        className="w-5 h-5 bg-slate-900 border border-slate-800 hover:border-cyan-500 rounded flex items-center justify-center text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

      {/* 3. SLEEK HORIZONTAL HUD COMMAND PANEL */}
      <div id="hud-panel" className="w-full flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mt-auto py-2.5 px-6 bg-slate-950/95 border-t border-cyan-500/30 backdrop-blur-md pointer-events-auto shadow-[0_-4px_30px_rgba(0,0,0,0.8)] z-10">
        
        {/* Row/Flex container for selection info and buildings/units actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Active Selection Info */}
          {selectedBuilding ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded p-1.5 flex items-center gap-3">
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-cyan-400" />
                  {selectedBuilding.type === BuildingType.COMMAND_CENTER ? t.cc : selectedBuilding.type === BuildingType.BARRACKS ? t.barracks : selectedBuilding.type === BuildingType.TURRET ? t.turret : "چاپخانه پول / Central Bank"}
                </p>
                <span className="text-[9px] text-cyan-400 font-mono font-bold">
                  {selectedBuilding.hp}/{selectedBuilding.maxHp} HP
                </span>
              </div>

              {!selectedBuilding.isComplete && (
                <div className="w-24 space-y-0.5">
                  <p className="text-[8px] text-slate-400 font-mono uppercase tracking-tighter">PROGRESS: {Math.floor(selectedBuilding.buildProgress)}%</p>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full" style={{ width: `${selectedBuilding.buildProgress}%` }} />
                  </div>
                </div>
              )}

              {selectedBuilding.isComplete && (
                <div className="flex items-center gap-1.5">
                  {selectedBuilding.type === BuildingType.COMMAND_CENTER && (
                    <button
                      onClick={() => onTrainUnit(UnitType.WORKER)}
                      className="py-1 px-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-400 rounded text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Users className="w-3 h-3 text-cyan-400" />
                      <span>{t.worker}</span>
                      <span className="text-amber-400 font-mono font-black">50🪙</span>
                    </button>
                  )}

                  {selectedBuilding.type === BuildingType.BARRACKS && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onTrainUnit(UnitType.SOLDIER)}
                        className="py-1 px-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-400 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Swords className="w-3 h-3 text-cyan-400" />
                        <span>{t.soldier}</span>
                        <span className="text-amber-400 font-mono font-black">100🪙</span>
                      </button>
                      <button
                        onClick={() => onTrainUnit(UnitType.HEAVY)}
                        className="py-1 px-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-400 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Crosshair className="w-3 h-3 text-cyan-400" />
                        <span>{t.heavy}</span>
                        <span className="text-amber-400 font-mono font-black">250🪙</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedBuilding.productionQueue.length > 0 && (
                <div className="w-20 space-y-0.5">
                  <div className="flex justify-between items-center text-[8px] text-slate-400">
                    <span>Q: {selectedBuilding.productionQueue.length}</span>
                    <span>{Math.floor(selectedBuilding.productionProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full" style={{ width: `${selectedBuilding.productionProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          ) : selectedUnits.length > 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded p-1.5 flex items-center gap-3">
              <div className="text-left flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-300">{selectedUnits.length}U</span>
                <button
                  onClick={onClearSelection}
                  className="text-[8px] px-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Composition labels */}
              <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-slate-400">
                {workersSelected.length > 0 && <span>🛠️x{workersSelected.length}</span>}
                {soldiersSelected.length > 0 && <span>🔫x{soldiersSelected.length}</span>}
                {heavySelected.length > 0 && <span>🛡️x{heavySelected.length}</span>}
              </div>

              {/* Build commands (workers selected) */}
              {hasWorkersSelected && (
                <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-800 pl-2">
                  <button
                    onClick={() => onBuildSelect(BuildingType.COMMAND_CENTER)}
                    className="py-1 px-1.5 bg-slate-800/80 border border-slate-700 hover:border-cyan-400 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Command Center / قلعه"
                  >
                    <span>+HQ</span>
                    <span className="text-amber-400 font-mono text-[8px]">400🪙</span>
                  </button>
                  <button
                    onClick={() => onBuildSelect(BuildingType.HOUSE)}
                    className="py-1 px-1.5 bg-slate-800/80 border border-slate-700 hover:border-cyan-400 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer"
                    title="House / خانه"
                  >
                    <span>+خانه</span>
                    <span className="text-amber-400 font-mono text-[8px]">75🪙</span>
                  </button>
                  <button
                    onClick={() => onBuildSelect(BuildingType.BARRACKS)}
                    className="py-1 px-1.5 bg-slate-800/80 border border-slate-700 hover:border-cyan-400 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Barracks / پادگان"
                  >
                    <span>+پادگان</span>
                    <span className="text-amber-400 font-mono text-[8px]">150🪙</span>
                  </button>
                  <button
                    onClick={() => onBuildSelect(BuildingType.TURRET)}
                    className="py-1 px-1.5 bg-slate-800/80 border border-slate-700 hover:border-rose-400 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Turret / برجک"
                  >
                    <span>+برجک</span>
                    <span className="text-amber-400 font-mono text-[8px]">125🪙</span>
                  </button>
                  <button
                    onClick={() => onBuildSelect(BuildingType.MINTING_CENTER)}
                    className="py-1 px-1.5 bg-amber-950/40 border border-amber-800/60 hover:border-amber-400 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Minting Center / چاپخانه پول"
                  >
                    <span>+بانک</span>
                    <span className="text-amber-400 font-mono text-[8px]">200🪙</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-slate-600 animate-pulse" />
              <span>COMMAND TERMINAL: STANDBY</span>
            </div>
          )}
          
          {/* Central Bank Quick Status Block */}
          <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded px-3 py-1.5 min-w-[240px]">
            <div className="p-1 bg-amber-500/10 rounded border border-amber-500/20">
              <Landmark className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[9px] text-slate-400 font-bold tracking-wide leading-tight">پشتوانه: {currencies.player.backingResource} ({currencies.player.backingAmount})</p>
              <p className="text-xs text-amber-200 font-black font-mono">
                {currencies.player.currencySymbol} {foreignBalances.player.toLocaleString()} Rials (Rate: {currencies.player.exchangeRate}x)
              </p>
            </div>
            <button
              onClick={() => {
                setShowEconomyDashboard(true);
                sound.playSelect();
              }}
              className="py-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-black text-[10px] tracking-wider transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)] hover:scale-105 cursor-pointer flex items-center gap-1"
            >
              <span>بازار بورس</span>
              <TrendingUp className="w-3 h-3" />
            </button>
          </div>
          
          {/* Upgrades panel if player has space */}
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-[10px] font-bold text-cyan-400 font-mono uppercase tracking-widest hidden xl:inline">ارتقاها:</span>
            <button
              id="upgrade-gather-btn"
              disabled={upgrades.fastGather}
              onClick={() => onBuyUpgrade('fastGather')}
              className={`py-1 px-2 rounded text-[10px] font-bold transition-all flex flex-col items-center justify-center cursor-pointer min-w-[75px] ${
                upgrades.fastGather 
                  ? 'bg-slate-900 text-slate-500 border border-slate-800/40' 
                  : 'bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 text-slate-200'
              }`}
            >
              <span className="text-[9px] tracking-tighter">{t.fastGather}</span>
              <span className="text-amber-400 font-mono text-[8px] font-black mt-0.5">
                {upgrades.fastGather ? '✔ MAX' : '150 🪙'}
              </span>
            </button>
            <button
              id="upgrade-speed-btn"
              disabled={upgrades.speedBoost}
              onClick={() => onBuyUpgrade('speedBoost')}
              className={`py-1 px-2 rounded text-[10px] font-bold transition-all flex flex-col items-center justify-center cursor-pointer min-w-[75px] ${
                upgrades.speedBoost 
                  ? 'bg-slate-900 text-slate-500 border border-slate-800/40' 
                  : 'bg-slate-800/40 border border-slate-700/60 hover:border-cyan-400 text-slate-200'
              }`}
            >
              <span className="text-[9px] tracking-tighter">{t.speedBoost}</span>
              <span className="text-amber-400 font-mono text-[8px] font-black mt-0.5">
                {upgrades.speedBoost ? '✔ MAX' : '200 🪙'}
              </span>
            </button>
          </div>
        </div>

        {/* Right side Touch Selection Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Touch Select Toggle Mode */}
          <div className="flex items-center gap-1.5 bg-slate-900/40 border border-slate-800/60 rounded px-2 py-1">
            <span className="text-[9px] font-bold tracking-widest text-slate-400 font-mono">MODE:</span>
            <div className="flex gap-1">
              <button
                id="touch-mode-select-btn"
                onClick={() => {
                  setTouchMode('SELECT');
                  sound.playSelect();
                }}
                className={`text-[10px] px-2.5 py-1 rounded font-bold tracking-wider transition-all cursor-pointer ${
                  touchMode === 'SELECT'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.boxSelect}
              </button>
              <button
                id="touch-mode-pan-btn"
                onClick={() => {
                  setTouchMode('PAN');
                  sound.playSelect();
                }}
                className={`text-[10px] px-2.5 py-1 rounded font-bold tracking-wider transition-all cursor-pointer ${
                  touchMode === 'PAN'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.panMap}
              </button>
            </div>
          </div>

          {/* Quick Selectors */}
          <div className="flex items-center gap-1.5">
            <button
              id="select-combat-troops-btn"
              onClick={onSelectAllCombat}
              className="py-1.5 px-2.5 text-[10px] font-bold tracking-wider uppercase bg-slate-900/60 border border-slate-800 hover:border-cyan-400 hover:bg-slate-800/80 rounded flex items-center gap-1.5 text-slate-200 transition-colors cursor-pointer"
            >
              <Swords className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">{t.selectAllCombat}</span>
            </button>
            
            <button
              id="select-workers-btn"
              onClick={onSelectAllWorkers}
              className="py-1.5 px-2.5 text-[10px] font-bold tracking-wider uppercase bg-slate-900/60 border border-slate-800 hover:border-cyan-400 hover:bg-slate-800/80 rounded flex items-center gap-1.5 text-slate-200 transition-colors cursor-pointer"
            >
              <Hammer className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{t.selectAllWorkers}</span>
            </button>
          </div>
        </div>

      </div>

      {/* SOVEREIGN ECONOMY & FOREIGN EXCHANGE MARKETPLACE DASHBOARD MODAL */}
      {showEconomyDashboard && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-5xl bg-slate-950/95 border-2 border-amber-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-950/50 to-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <Landmark className="w-5 h-5 text-amber-400 animate-bounce" />
                </div>
                <div className="text-left">
                  <h2 className="text-base font-black text-amber-300 tracking-wider">بازار جامع تجارت و بورس ارزی ملل / Sovereign Economy Hub</h2>
                  <p className="text-[10px] text-slate-400 uppercase font-mono">Cross-State Commodity Trade & Minting Central Bank Controls</p>
                </div>
              </div>
              
              {/* Account Indicators */}
              <div className="flex items-center gap-3 bg-black/40 border border-slate-800 px-4 py-1 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">Account Balance:</span>
                <span className="text-sm font-black text-amber-400 font-mono">﷼ {foreignBalances.player.toLocaleString()} Rials</span>
              </div>

              <button
                onClick={() => setShowEconomyDashboard(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Main Scrollable Grid */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 1: CENTRAL MINTING CENTER */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-4">
                <div className="border-b border-slate-800 pb-2 mb-1">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 justify-start">
                    <CircleDollarSign className="w-4 h-4" />
                    <span>بانک مرکزی پارس (چاپخانه پول)</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 text-left uppercase font-mono">Central Minting Policy Command</p>
                </div>

                {!hasMintingCenter ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-black/20 rounded-lg border border-dashed border-slate-800">
                    <Minimize2 className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-400 font-bold leading-relaxed">
                      سازه‌ای با عنوان «چاپخانه پول» یافت نشد. برای مدیریت فعال پشتوانه پولی و انتشار ارز، ابتدا چاپخانه پول را توسط کارگران خود احداث کنید!
                    </p>
                    <span className="text-[9px] text-amber-400/80 font-mono mt-2 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded">
                      MINTING CENTER COST: 200 GOLD
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4 text-left">
                    <div className="bg-black/40 p-3 rounded-lg border border-slate-800 space-y-1.5">
                      <p className="text-[10px] text-slate-400 uppercase font-mono font-bold">Pegged Currency Backing / تعیین پشتوانه پول:</p>
                      <select
                        value={currencies.player.backingResource}
                        onChange={(e) => {
                          const res = e.target.value as ResourceType;
                          setCurrencies(prev => {
                            const next = { ...prev };
                            next.player.backingResource = res;
                            next.player.exchangeRate = calculateRate(next.player);
                            return next;
                          });
                          sound.playSelect();
                        }}
                        className="w-full bg-slate-950 border border-slate-800 hover:border-amber-500 rounded px-2.5 py-1.5 text-xs text-amber-200 font-bold focus:outline-none cursor-pointer"
                      >
                        <option value={ResourceType.GOLD}>Gold (طلا) - High Value / Stability</option>
                        <option value={ResourceType.OIL}>Oil (نفت) - Dynamic Yield</option>
                        <option value={ResourceType.IRON}>Iron (آهن) - Industrial Strength</option>
                        <option value={ResourceType.COAL}>Coal (زغال سنگ) - Basal Fuel</option>
                        <option value={ResourceType.STONE}>Stone (سنگ) - Structural Support</option>
                        <option value={ResourceType.WOOD}>Wood (چوب) - Organic Reserve</option>
                      </select>
                      <p className="text-[9px] text-slate-500">تغییر پشتوانه بر اساس ارزش پایه کالا در خزانه شما، ارزش ریال پارس را فوراً تغییر می‌دهد.</p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-black/20 p-2 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-500 block uppercase">Circulating Cash</span>
                        <span className="font-bold text-slate-300">﷼ {currencies.player.circulatingSupply.toLocaleString()}</span>
                      </div>
                      <div className="bg-black/20 p-2 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-500 block uppercase">Reserves Peg</span>
                        <span className="font-bold text-amber-400">{currencies.player.backingAmount.toLocaleString()} {currencies.player.backingResource}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => {
                          // Print money: adds 1500 Rials to player balance, increases supply by 1800, lowers rate
                          setCurrencies(prev => {
                            const next = { ...prev };
                            next.player.circulatingSupply += 1800;
                            next.player.exchangeRate = calculateRate(next.player);
                            return next;
                          });
                          setForeignBalances(prev => ({
                            ...prev,
                            player: prev.player + 1500
                          }));
                          sound.playCommand();
                        }}
                        className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs tracking-wider transition-all cursor-pointer text-center block shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      >
                        [ 🖨️ چاپ ۱٬۵۰۰ ریال پارس ]
                      </button>
                      <p className="text-[9px] text-red-400 text-center">چاپ پول بدون پشتوانه باعث کاهش ارزش ارز (تورم) در بازارهای جهانی می‌شود.</p>

                      <button
                        onClick={() => {
                          // Spends 100 units of backing resource to buy back and burn 1,500 circulating Rials
                          const pegRes = currencies.player.backingResource;
                          // Check if player has 100 of that resource in RTS
                          let playerAmt = 0;
                          if (pegRes === ResourceType.GOLD) playerAmt = resources.gold;
                          else if (pegRes === ResourceType.WOOD) playerAmt = resources.wood;
                          else if (pegRes === ResourceType.STONE) playerAmt = resources.stone;
                          else if (pegRes === ResourceType.IRON) playerAmt = resources.iron;
                          else if (pegRes === ResourceType.COAL) playerAmt = resources.coal;
                          else if (pegRes === ResourceType.OIL) playerAmt = resources.oil;

                          if (playerAmt < 100) {
                            sound.playSelect();
                            alert(`برای جمع‌آوری پول حداقل نیاز به ۱۰۰ واحد از پشتوانه انتخابی (${pegRes}) در خزانه دارید!`);
                            return;
                          }
                          if (foreignBalances.player < 1500) {
                            sound.playSelect();
                            alert("شما فاقد ۱٬۵۰۰ ریال پارس برای انهدام و خارج کردن از گردش مالی هستید!");
                            return;
                          }

                          // Deduct resource
                          const updated = { ...resources };
                          if (pegRes === ResourceType.GOLD) updated.gold -= 100;
                          else if (pegRes === ResourceType.WOOD) updated.wood -= 100;
                          else if (pegRes === ResourceType.STONE) updated.stone -= 100;
                          else if (pegRes === ResourceType.IRON) updated.iron -= 100;
                          else if (pegRes === ResourceType.COAL) updated.coal -= 100;
                          else if (pegRes === ResourceType.OIL) updated.oil -= 100;
                          onUpdateResources(updated);

                          // Update currency circulating supply
                          setCurrencies(prev => {
                            const next = { ...prev };
                            next.player.circulatingSupply = Math.max(500, next.player.circulatingSupply - 1500);
                            next.player.exchangeRate = calculateRate(next.player);
                            return next;
                          });

                          // Deduct balance
                          setForeignBalances(prev => ({
                            ...prev,
                            player: prev.player - 1500
                          }));

                          sound.playBuildComplete();
                        }}
                        className="w-full py-2 px-3 bg-slate-900 border border-amber-500/30 hover:border-amber-400 text-amber-400 font-bold rounded-lg text-xs tracking-wider transition-all cursor-pointer text-center block"
                      >
                        🔥 جمع‌آوری و تقویت پول (سوزاندن ریال)
                      </button>
                      <p className="text-[9px] text-slate-500 text-center">پرداخت ۱۰۰ واحد کالا برای نابود کردن ۱٬۵۰۰ ریال، ارزش واحد پولی را افزایش می‌دهد.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 2: COMMODITY TRADING */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-4">
                <div className="border-b border-slate-800 pb-2 mb-1">
                  <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-1.5 justify-start">
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>تالار معامله و بورس کالا</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 text-left uppercase font-mono">Commodity buy / sell marketplace</p>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                  {([ResourceType.GOLD, ResourceType.WOOD, ResourceType.STONE, ResourceType.IRON, ResourceType.COAL, ResourceType.OIL] as const).map(res => {
                    // Let's compute pricing based on overall game state
                    const globalInventory = Object.values(resources).reduce((a, b) => a + b, 0);
                    const { buyPrice, sellPrice } = getCommodityPrice(res, globalInventory);
                    
                    // Real-time RTS resource amount held
                    let inGameAmount = 0;
                    if (res === ResourceType.GOLD) inGameAmount = resources.gold;
                    else if (res === ResourceType.WOOD) inGameAmount = resources.wood;
                    else if (res === ResourceType.STONE) inGameAmount = resources.stone;
                    else if (res === ResourceType.IRON) inGameAmount = resources.iron;
                    else if (res === ResourceType.COAL) inGameAmount = resources.coal;
                    else if (res === ResourceType.OIL) inGameAmount = resources.oil;

                    const handleBuy = (qty: number) => {
                      const totalCost = Math.round(buyPrice * qty * 10) / 10;
                      if (foreignBalances.player < totalCost) {
                        sound.playSelect();
                        alert(`موجودی ریال کافی نیست! برای خرید این مقدار کالا نیاز به ${totalCost} ریال دارید.`);
                        return;
                      }

                      // Deduct cash and add resource
                      setForeignBalances(prev => ({ ...prev, player: prev.player - totalCost }));
                      const updated = { ...resources };
                      if (res === ResourceType.GOLD) updated.gold += qty;
                      else if (res === ResourceType.WOOD) updated.wood += qty;
                      else if (res === ResourceType.STONE) updated.stone += qty;
                      else if (res === ResourceType.IRON) updated.iron += qty;
                      else if (res === ResourceType.COAL) updated.coal += qty;
                      else if (res === ResourceType.OIL) updated.oil += qty;
                      
                      onUpdateResources(updated);
                      sound.playCommand();
                    };

                    const handleSell = (qty: number) => {
                      if (inGameAmount < qty) {
                        sound.playSelect();
                        alert(`عدم موجودی کالا در انبار! شما فقط ${inGameAmount} واحد از این کالا دارید.`);
                        return;
                      }

                      const totalYield = Math.round(sellPrice * qty * 10) / 10;
                      
                      // Deduct resource and add cash
                      const updated = { ...resources };
                      if (res === ResourceType.GOLD) updated.gold -= qty;
                      else if (res === ResourceType.WOOD) updated.wood -= qty;
                      else if (res === ResourceType.STONE) updated.stone -= qty;
                      else if (res === ResourceType.IRON) updated.iron -= qty;
                      else if (res === ResourceType.COAL) updated.coal -= qty;
                      else if (res === ResourceType.OIL) updated.oil -= qty;
                      
                      onUpdateResources(updated);
                      setForeignBalances(prev => ({ ...prev, player: prev.player + totalYield }));
                      sound.playCommand();
                    };

                    return (
                      <div key={res} className="p-2.5 bg-black/40 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                        <div className="text-left">
                          <span className="font-bold text-slate-200 tracking-wider flex items-center gap-1.5 uppercase">
                            {res === 'GOLD' && <Coins className="w-3.5 h-3.5 text-amber-400" />}
                            {res === 'WOOD' && <TreePine className="w-3.5 h-3.5 text-green-400" />}
                            {res === 'STONE' && <Gem className="w-3.5 h-3.5 text-slate-400" />}
                            {res === 'IRON' && <Wrench className="w-3.5 h-3.5 text-yellow-500" />}
                            {res === 'COAL' && <Flame className="w-3.5 h-3.5 text-orange-400" />}
                            {res === 'OIL' && <Droplet className="w-3.5 h-3.5 text-sky-400" />}
                            {res}
                          </span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">در اختیار: {inGameAmount}</span>
                        </div>

                        {/* Trade Buttons */}
                        <div className="flex items-center gap-1.5">
                          <div className="text-right mr-1.5">
                            <span className="text-[9px] text-emerald-400 block font-bold" title="Sell for Rials">خرید: {buyPrice}﷼</span>
                            <span className="text-[9px] text-rose-400 block font-bold" title="Buy with Rials">فروش: {sellPrice}﷼</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleBuy(20)}
                              className="px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 rounded text-[9px] font-black cursor-pointer"
                            >
                              +20 کالا
                            </button>
                            <button
                              onClick={() => handleSell(20)}
                              className="px-2 py-0.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 rounded text-[9px] font-black cursor-pointer"
                            >
                              -20 کالا
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: SOVEREIGN FOREX EXCHANGE */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-4">
                <div className="border-b border-slate-800 pb-2 mb-1">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 justify-start">
                    <TrendingUp className="w-4 h-4" />
                    <span>تالار بورس و تبادلات ارز ملل</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 text-left uppercase font-mono">Cross-border foreign exchange market</p>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                  {Object.keys(currencies).filter(key => key !== 'player').map(key => {
                    const curr = currencies[key];
                    const playerHolds = foreignBalances[key] || 0;
                    
                    // Trade operations
                    const buyForeign = (qty: number) => {
                      const totalCostRials = Math.round(curr.exchangeRate * qty * 10) / 10;
                      if (foreignBalances.player < totalCostRials) {
                        sound.playSelect();
                        alert(`موجودی ریال کافی نیست! برای خرید ${qty} ${curr.currencySymbol} نیاز به ${totalCostRials} ریال دارید.`);
                        return;
                      }

                      // Transact
                      setForeignBalances(prev => ({
                        ...prev,
                        player: prev.player - totalCostRials,
                        [key]: prev[key] + qty
                      }));
                      sound.playCommand();
                    };

                    const sellForeign = (qty: number) => {
                      if (playerHolds < qty) {
                        sound.playSelect();
                        alert(`عدم موجودی ارز خارجی! شما فاقد این مقدار ارز برای فروش هستید.`);
                        return;
                      }

                      const yieldRials = Math.round(curr.exchangeRate * qty * 0.95 * 10) / 10; // 5% spread fee on foreign cash out

                      setForeignBalances(prev => ({
                        ...prev,
                        player: prev.player + yieldRials,
                        [key]: prev[key] - qty
                      }));
                      sound.playCommand();
                    };

                    return (
                      <div key={key} className="p-2.5 bg-black/40 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                        <div className="text-left">
                          <p className="font-bold text-slate-200 leading-tight">{curr.factionName}</p>
                          <p className="text-[9px] text-amber-400 tracking-wider uppercase font-black">{curr.currencySymbol} {curr.currencyName}</p>
                          <span className="text-[8px] text-slate-500 block">پشتوانه: {curr.backingResource} ({curr.backingAmount})</span>
                        </div>

                        {/* Conversion Rate & Holds */}
                        <div className="text-right">
                          <span className="font-black text-cyan-300 text-xs block">{curr.exchangeRate}x Rial</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5">در اختیار شما: {playerHolds} {curr.currencySymbol}</span>
                          
                          <div className="flex gap-1 mt-1.5">
                            <button
                              onClick={() => buyForeign(500)}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-cyan-300 rounded text-[9px] font-black cursor-pointer"
                            >
                              خرید ۵۰۰
                            </button>
                            <button
                              onClick={() => sellForeign(500)}
                              className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded text-[9px] font-black cursor-pointer"
                            >
                              فروش ۵۰۰
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
