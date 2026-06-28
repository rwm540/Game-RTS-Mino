/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PlayerType, ResourceType, UnitType, BuildingType, UnitState, Unit, Building, ResourceNode, Projectile, Particle, Position, Difficulty, GameStats } from '../types';
import { createUnit, createBuilding, getBuildingCost, getUnitCost, distance, getAngle, findClosestResource, findClosestCommandCenter, findClosestEnemy, handleSeparation } from '../utils/gameHelpers';
import { sound } from '../utils/audio';
import { translations, Language } from '../utils/translations';
import { MapPin } from 'lucide-react';
import GameUI from './GameUI';

interface GameCanvasProps {
  difficulty: Difficulty;
  language: Language;
  onGameOver: (victory: boolean, stats: GameStats) => void;
  onBackToMenu: () => void;
}

export default function GameCanvas({ difficulty, language, onGameOver, onBackToMenu }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  // Core reactive UI states (synced periodically from game loop to avoid performance lag)
  const [minerals, setMinerals] = useState<number>(550); // Start with 550 gold
  const [resources, setResources] = useState({
    wood: 300,
    gold: 550,
    stone: 200,
    iron: 100,
    coal: 50,
    oil: 0,
    weapons: 10,
    ammo: 200,
  });
  const [factions, setFactions] = useState<Array<{
    id: string;
    name: string;
    leader: string;
    avatar: string;
    relation: number;
    status: 'ALLY' | 'NEUTRAL' | 'WAR';
    castleX: number;
    castleY: number;
  }>>([]);
  const [workerAssignments, setWorkerAssignments] = useState({
    GOLD: 4,
    WOOD: 0,
    STONE: 0,
    IRON: 0,
    COAL: 0,
    OIL: 0,
  });

  const [selectedUnits, setSelectedUnits] = useState<Unit[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [touchMode, setTouchMode] = useState<'SELECT' | 'PAN'>('SELECT');
  const [isPlacingBuilding, setIsPlacingBuilding] = useState<BuildingType | null>(null);
  const [underAttackAlert, setUnderAttackAlert] = useState<boolean>(false);
  const [enemyAttackTimer, setEnemyAttackTimer] = useState<number>(50); // seconds to AI wave
  const [currentPopulation, setCurrentPopulation] = useState<number>(4);
  const [maxPopulation, setMaxPopulation] = useState<number>(5);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Custom Upgrades
  const [upgrades, setUpgrades] = useState({
    fastGather: false,
    speedBoost: false,
  });

  // Game Engine State Refs (to maintain 60 FPS without React re-render throttling)
  const stateRef = useRef<{
    minerals: number;
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
    units: Unit[];
    buildings: Building[];
    mineralsNodes: ResourceNode[];
    projectiles: Projectile[];
    particles: Particle[];
    camera: { x: number; y: number; width: number; height: number };
    selectionBox: { start: Position | null; current: Position | null } | null;
    isPanning: boolean;
    panStart: Position | null;
    lastMouseMapPos: Position;
    aiAttackCooldown: number; // in frames
    aiMaxAttackCooldown: number; // in frames
    difficultyMultiplier: number;
    stats: GameStats;
    gameTicks: number;
    visualRipples: Array<{ x: number; y: number; radius: number; maxRadius: number; alpha: number }>;
    alertTimer: number; // frames alert is active
    upgrades: { fastGather: boolean; speedBoost: boolean };
  }>({
    minerals: 550,
    resources: {
      wood: 300,
      gold: 550,
      stone: 200,
      iron: 100,
      coal: 50,
      oil: 0,
      weapons: 10,
      ammo: 200,
    },
    factions: [],
    workerAssignments: {
      GOLD: 4,
      WOOD: 0,
      STONE: 0,
      IRON: 0,
      COAL: 0,
      OIL: 0,
    },
    units: [],
    buildings: [],
    mineralsNodes: [],
    projectiles: [],
    particles: [],
    camera: { x: 0, y: 800, width: 800, height: 600 }, // start camera looking near player bottom-left base
    selectionBox: null,
    isPanning: false,
    panStart: null,
    lastMouseMapPos: { x: 0, y: 0 },
    aiAttackCooldown: 3000, // starts soon
    aiMaxAttackCooldown: 3600, // waves every 60s at 60fps
    difficultyMultiplier: 1.0,
    stats: {
      mineralsMined: 0,
      unitsTrained: 0,
      unitsLost: 0,
      unitsKilled: 0,
      buildingsBuilt: 0,
      buildingsDestroyed: 0,
      gameDuration: 0,
    },
    gameTicks: 0,
    visualRipples: [],
    alertTimer: 0,
    upgrades: { fastGather: false, speedBoost: false },
  });

  // Map Constants
  const MAP_SIZE = 1600;

  // Initialize once
  useEffect(() => {
    // 1. Setup difficulty multipliers
    let diffMult = 1.0;
    let waveCooldown = 3600; // 60 seconds
    if (difficulty === 'EASY') {
      diffMult = 0.7;
      waveCooldown = 5400; // 90 seconds
    } else if (difficulty === 'HARD') {
      diffMult = 1.4;
      waveCooldown = 2400; // 40 seconds
    }
    
    stateRef.current.difficultyMultiplier = diffMult;
    stateRef.current.aiMaxAttackCooldown = waveCooldown;
    stateRef.current.aiAttackCooldown = waveCooldown;

    // 2. Define the 10 Factions
    const initialFactions = [
      { id: 'player', name: 'شما (جمهوری پارس)', leader: 'فرمانده آریا', avatar: '👑', relation: 100, status: 'ALLY' as const, castleX: 150, castleY: 1450 },
      { id: 'enemy', name: 'لشکر سیاه اهریمن', leader: 'اسفندیار تاریک', avatar: '💀', relation: 0, status: 'WAR' as const, castleX: 1450, castleY: 150 },
      { id: 'f1', name: 'قلعه بابک (آذربایجان)', leader: 'بابک خرمدین', avatar: '🦅', relation: 50, status: 'NEUTRAL' as const, castleX: 200, castleY: 200 },
      { id: 'f2', name: 'قلعه توس (خراسان)', leader: 'پهلوان طوس', avatar: '🦁', relation: 50, status: 'NEUTRAL' as const, castleX: 800, castleY: 200 },
      { id: 'f3', name: 'قلعه اصفهان (سپاهان)', leader: 'کیقباد دوم', avatar: '🕌', relation: 50, status: 'NEUTRAL' as const, castleX: 1400, castleY: 800 },
      { id: 'f4', name: 'قلعه بیشاپور (فارس)', leader: 'شاهپور ساسانی', avatar: '🏺', relation: 50, status: 'NEUTRAL' as const, castleX: 800, castleY: 1400 },
      { id: 'f5', name: 'قلعه هگمتانه (ماد)', leader: 'دیااکو بزرگ', avatar: '🏛️', relation: 60, status: 'NEUTRAL' as const, castleX: 200, castleY: 800 },
      { id: 'f6', name: 'قلعه ری (کاسپین)', leader: 'مازیار طبرستانی', avatar: '🌊', relation: 55, status: 'NEUTRAL' as const, castleX: 500, castleY: 500 },
      { id: 'f7', name: 'قلعه شوش (خوزستان)', leader: 'شاه اونتاش ناپیریشا', avatar: '🌾', relation: 45, status: 'NEUTRAL' as const, castleX: 1100, castleY: 1100 },
      { id: 'f8', name: 'قلعه زابل (نیمروز)', leader: 'رستم پهلوان', avatar: '🏹', relation: 65, status: 'NEUTRAL' as const, castleX: 500, castleY: 1100 }
    ];
    stateRef.current.factions = initialFactions;
    setFactions(initialFactions);

    // 3. Spawn Starting Entities
    const units: Unit[] = [];
    const buildings: Building[] = [];
    const mineralsNodes: ResourceNode[] = [];

    // Player starting workers
    const w1 = createUnit(UnitType.WORKER, PlayerType.PLAYER, 180, 1300);
    w1.factionId = 'player';
    units.push(w1);
    const w2 = createUnit(UnitType.WORKER, PlayerType.PLAYER, 220, 1300);
    w2.factionId = 'player';
    units.push(w2);
    const w3 = createUnit(UnitType.WORKER, PlayerType.PLAYER, 250, 1340);
    w3.factionId = 'player';
    units.push(w3);
    const w4 = createUnit(UnitType.WORKER, PlayerType.PLAYER, 150, 1340);
    w4.factionId = 'player';
    units.push(w4);

    // Spawn 10 Castles (Command Centers) on the map for all factions except player
    initialFactions.forEach(f => {
      if (f.id === 'player') return;
      
      const pType = f.id === 'enemy' ? PlayerType.ENEMY : PlayerType.NEUTRAL;
      const cc = createBuilding(BuildingType.COMMAND_CENTER, pType, f.castleX, f.castleY, true);
      cc.factionId = f.id;
      buildings.push(cc);

      // Add a defense turret for each castle except player
      const turret = createBuilding(BuildingType.TURRET, pType, f.castleX + 60, f.castleY + 60, true);
      turret.factionId = f.id;
      buildings.push(turret);

      // Add 2 initial workers for each AI castle to gather resources
      const w1 = createUnit(UnitType.WORKER, pType, f.castleX - 40, f.castleY + 30);
      w1.factionId = f.id;
      units.push(w1);
      const w2 = createUnit(UnitType.WORKER, pType, f.castleX + 40, f.castleY - 30);
      w2.factionId = f.id;
      units.push(w2);

      // Generate surrounding resource nodes near each castle
      const resTypes = [ResourceType.GOLD, ResourceType.WOOD, ResourceType.STONE, ResourceType.IRON, ResourceType.COAL, ResourceType.OIL];
      resTypes.forEach((rType, idx) => {
        const angle = (idx / resTypes.length) * Math.PI * 2;
        const dist = 140 + Math.random() * 40;
        const rx = f.castleX + Math.cos(angle) * dist;
        const ry = f.castleY + Math.sin(angle) * dist;
        
        mineralsNodes.push({
          id: `res_${f.id}_${idx}`,
          x: Math.max(50, Math.min(rx, MAP_SIZE - 50)),
          y: Math.max(50, Math.min(ry, MAP_SIZE - 50)),
          amount: 3000,
          maxAmount: 3000,
          size: rType === ResourceType.GOLD ? 20 : 18,
          resourceType: rType
        });
      });
    });

    // Also spawn player starting mineral nodes
    const pResTypes = [ResourceType.GOLD, ResourceType.GOLD, ResourceType.WOOD, ResourceType.WOOD, ResourceType.STONE, ResourceType.IRON];
    pResTypes.forEach((rType, idx) => {
      const angle = (idx / pResTypes.length) * Math.PI * 2;
      const dist = 130 + Math.random() * 30;
      const rx = 180 + Math.cos(angle) * dist;
      const ry = 1300 + Math.sin(angle) * dist;
      mineralsNodes.push({
        id: `res_player_${idx}`,
        x: Math.max(50, Math.min(rx, MAP_SIZE - 50)),
        y: Math.max(50, Math.min(ry, MAP_SIZE - 50)),
        amount: 3500,
        maxAmount: 3500,
        size: rType === ResourceType.GOLD ? 22 : 18,
        resourceType: rType
      });
    });

    // Spawn some rich contested neutral nodes in the map center
    mineralsNodes.push({ id: 'nm1', x: 800, y: 800, amount: 6000, maxAmount: 6000, size: 24, resourceType: ResourceType.GOLD });
    mineralsNodes.push({ id: 'nm2', x: 740, y: 860, amount: 5000, maxAmount: 5000, size: 20, resourceType: ResourceType.IRON });
    mineralsNodes.push({ id: 'nm3', x: 860, y: 740, amount: 5000, maxAmount: 5000, size: 20, resourceType: ResourceType.STONE });
    mineralsNodes.push({ id: 'nm4', x: 860, y: 860, amount: 5000, maxAmount: 5000, size: 20, resourceType: ResourceType.WOOD });
    mineralsNodes.push({ id: 'nm5', x: 740, y: 740, amount: 4000, maxAmount: 4000, size: 20, resourceType: ResourceType.OIL });

    stateRef.current.units = units;
    stateRef.current.buildings = buildings;
    stateRef.current.mineralsNodes = mineralsNodes;

    // Reset camera to player base on startup
    stateRef.current.camera.x = 0;
    stateRef.current.camera.y = 1000;

    sound.playBuildComplete();
  }, [difficulty]);

  // Handle Resize and Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      // Sync camera size
      stateRef.current.camera.width = canvas.width;
      stateRef.current.camera.height = canvas.height;

      // Keep camera inside boundaries
      stateRef.current.camera.x = Math.max(0, Math.min(MAP_SIZE - canvas.width, stateRef.current.camera.x));
      stateRef.current.camera.y = Math.max(0, Math.min(MAP_SIZE - canvas.height, stateRef.current.camera.y));
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Keyboard Panning event handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        // Prevent default scrolling of page when user pans inside the canvas
        e.preventDefault();
      }
      keysPressedRef.current[key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressedRef.current[key] = false;
    };

    // Mouse wheel panning
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = stateRef.current;
      const cam = state.camera;
      const scrollSpeed = 1.0;

      state.camera.x = Math.max(0, Math.min(MAP_SIZE - cam.width, cam.x + e.deltaX * scrollSpeed));
      state.camera.y = Math.max(0, Math.min(MAP_SIZE - cam.height, cam.y + e.deltaY * scrollSpeed));
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Loop
    let animId: number;
    
    const tick = () => {
      updateGameState();
      renderGame();
      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Sync state periodically to React UI (every 10 ticks to keep things hyper-performant)
  useEffect(() => {
    const interval = setInterval(() => {
      const state = stateRef.current;
      state.minerals = state.resources.gold;
      setMinerals(state.minerals);
      setResources({ ...state.resources });
      setFactions([...state.factions]);
      setWorkerAssignments({ ...state.workerAssignments });
      
      // Update selected units reference safely
      const selUnits = state.units.filter(u => u.selected && u.hp > 0 && u.player === PlayerType.PLAYER);
      setSelectedUnits(selUnits);

      // Update selected building
      const selBuilding = state.buildings.find(b => b.id === stateRef.current.selectedBuildingId && b.hp > 0);
      setSelectedBuilding(selBuilding || null);

      // Alarm & Waves timer
      setUnderAttackAlert(state.alertTimer > 0);
      setEnemyAttackTimer(Math.max(0, Math.floor(state.aiAttackCooldown / 60)));

      // Calculate population dynamically
      const playerUnitsCount = state.units.filter(u => u.player === PlayerType.PLAYER && u.hp > 0).length;
      const playerHouses = state.buildings.filter(b => b.player === PlayerType.PLAYER && b.type === BuildingType.HOUSE && b.isComplete && b.hp > 0).length;
      const playerCCs = state.buildings.filter(b => b.player === PlayerType.PLAYER && b.type === BuildingType.COMMAND_CENTER && b.isComplete && b.hp > 0).length;
      const computedMax = 5 + (playerCCs * 10) + (playerHouses * 5);
      const maxCap = Math.min(50, computedMax);

      setCurrentPopulation(playerUnitsCount);
      setMaxPopulation(maxCap);
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Core Game State Updaters
  const updateGameState = () => {
    const state = stateRef.current;
    state.gameTicks++;
    
    // Keyboard Map Scrolling (WASD & Arrows)
    const keys = keysPressedRef.current;
    const cam = state.camera;
    const camSpeed = 15; // fast smooth camera panning

    if (keys['w'] || keys['arrowup']) {
      cam.y = Math.max(0, cam.y - camSpeed);
    }
    if (keys['s'] || keys['arrowdown']) {
      cam.y = Math.min(MAP_SIZE - cam.height, cam.y + camSpeed);
    }
    if (keys['a'] || keys['arrowleft']) {
      cam.x = Math.max(0, cam.x - camSpeed);
    }
    if (keys['d'] || keys['arrowright']) {
      cam.x = Math.min(MAP_SIZE - cam.width, cam.x + camSpeed);
    }

    // Worker Auto-Assignment AI Loop (Runs every 30 game ticks)
    if (state.gameTicks % 30 === 0) {
      const playerWorkers = state.units.filter(u => u.player === PlayerType.PLAYER && u.type === UnitType.WORKER && u.hp > 0);
      
      const roleCounts = { GOLD: 0, WOOD: 0, STONE: 0, IRON: 0, COAL: 0, OIL: 0 };
      playerWorkers.forEach(w => {
        if (w.role) roleCounts[w.role]++;
      });
      
      const targetCounts = state.workerAssignments;
      
      playerWorkers.forEach(w => {
        if (!w.role) {
          const unfilledRole = (Object.keys(targetCounts) as Array<keyof typeof targetCounts>).find(
            role => roleCounts[role] < targetCounts[role]
          );
          if (unfilledRole) {
            w.role = unfilledRole as ResourceType;
            roleCounts[unfilledRole]++;
          } else {
            w.role = ResourceType.GOLD;
          }
        } else {
          const currentRole = w.role;
          if (roleCounts[currentRole] > targetCounts[currentRole]) {
            const unfilledRole = (Object.keys(targetCounts) as Array<keyof typeof targetCounts>).find(
              role => roleCounts[role] < targetCounts[role]
            );
            if (unfilledRole) {
              roleCounts[currentRole]--;
              w.role = unfilledRole as ResourceType;
              roleCounts[unfilledRole]++;
              
              w.targetId = null;
              w.targetX = null;
              w.targetY = null;
              w.state = UnitState.IDLE;
            }
          }
        }
      });
      
      playerWorkers.forEach(w => {
        if (w.state === UnitState.IDLE && w.role) {
          const nodes = state.mineralsNodes.filter(n => n.resourceType === w.role && n.amount > 0);
          let closestNode = null;
          let minDist = Infinity;
          nodes.forEach(n => {
            const d = distance(w.x, w.y, n.x, n.y);
            if (d < minDist) {
              minDist = d;
              closestNode = n;
            }
          });
          
          if (closestNode) {
            w.targetId = (closestNode as ResourceNode).id;
            w.targetX = (closestNode as ResourceNode).x;
            w.targetY = (closestNode as ResourceNode).y;
            w.state = UnitState.MINING_GOING;
          }
        }
      });
    }

    // Industrial Production Loop (Runs every 120 game ticks - approx 2 seconds)
    if (state.gameTicks % 120 === 0) {
      const completedWeaponsFactories = state.buildings.filter(b => b.player === PlayerType.PLAYER && b.type === BuildingType.WEAPONS_FACTORY && b.isComplete && b.hp > 0).length;
      if (completedWeaponsFactories > 0) {
        if (state.resources.wood >= 3 && state.resources.iron >= 1) {
          state.resources.wood -= 3;
          state.resources.iron -= 1;
          state.resources.weapons += 1;
          
          const factory = state.buildings.find(b => b.player === PlayerType.PLAYER && b.type === BuildingType.WEAPONS_FACTORY && b.isComplete && b.hp > 0);
          if (factory) {
            state.particles.push({
              id: Math.random().toString(),
              x: factory.x,
              y: factory.y - 20,
              vx: 0, vy: -1, color: '#fbbf24', size: 4, alpha: 1.0, life: 40, maxLife: 40
            });
          }
        }
      }
      
      const completedAmmoFactories = state.buildings.filter(b => b.player === PlayerType.PLAYER && b.type === BuildingType.AMMO_FACTORY && b.isComplete && b.hp > 0).length;
      if (completedAmmoFactories > 0) {
        if (state.resources.coal >= 2 && state.resources.iron >= 1) {
          state.resources.coal -= 2;
          state.resources.iron -= 1;
          state.resources.ammo += 15;
          
          const factory = state.buildings.find(b => b.player === PlayerType.PLAYER && b.type === BuildingType.AMMO_FACTORY && b.isComplete && b.hp > 0);
          if (factory) {
            state.particles.push({
              id: Math.random().toString(),
              x: factory.x,
              y: factory.y - 20,
              vx: 0, vy: -1, color: '#38bdf8', size: 4, alpha: 1.0, life: 40, maxLife: 40
            });
          }
        }
      }
    }

    // Decrement alert frames
    if (state.alertTimer > 0) state.alertTimer--;

    // Update Game Duration seconds
    if (state.gameTicks % 60 === 0) {
      state.stats.gameDuration++;
    }

    // 1. Particle life cycles
    state.particles = state.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });

    // 2. Ripple animations
    state.visualRipples = state.visualRipples.filter(r => {
      r.radius += 0.8;
      r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);
      return r.alpha > 0;
    });

    // 3. Projectiles movement and collision
    state.projectiles = state.projectiles.filter(proj => {
      // Move projectile towards target map coordinates
      const distToTarget = distance(proj.x, proj.y, proj.targetX, proj.targetY);
      
      if (distToTarget < proj.speed + 3) {
        // Impact! Deal damage to target entity if it's still alive
        if (proj.targetId) {
          const targetUnit = state.units.find(u => u.id === proj.targetId);
          if (targetUnit && targetUnit.hp > 0) {
            targetUnit.hp -= proj.damage;
            if (targetUnit.hp <= 0) {
              if (proj.player === PlayerType.PLAYER) state.stats.unitsKilled++;
              else state.stats.unitsLost++;
            }
          } else {
            const targetBuilding = state.buildings.find(b => b.id === proj.targetId);
            if (targetBuilding && targetBuilding.hp > 0) {
              targetBuilding.hp -= proj.damage;
              if (targetBuilding.hp <= 0) {
                if (proj.player === PlayerType.PLAYER) state.stats.buildingsDestroyed++;
              }
            }
          }
        }

        // Spawn visual explosion particles
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = Math.random() * 2 + 1;
          state.particles.push({
            id: Math.random().toString(),
            x: proj.targetX,
            y: proj.targetY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            color: proj.color,
            size: Math.random() * 3 + 1,
            alpha: 1.0,
            life: Math.random() * 20 + 10,
            maxLife: 30,
          });
        }

        return false; // delete projectile
      }

      // Keep moving
      proj.x += proj.vx;
      proj.y += proj.vy;
      return true;
    });

    // 4. Update Buildings Production and Repairs
    state.buildings.forEach(b => {
      if (b.hp <= 0) return;

      // Defense tower auto shooting
      if (b.type === BuildingType.TURRET && b.isComplete) {
        if (b.attackCooldown > 0) {
          b.attackCooldown--;
        } else {
          // Find closest enemy in range
          const enemy = findClosestEnemy({ x: b.x, y: b.y, player: b.player, range: b.attackRange }, state.units, state.buildings);
          if (enemy) {
            const tgt = enemy.target;
            const dist = distance(b.x, b.y, tgt.x, tgt.y);
            
            // Spawn missile
            const angle = getAngle(b.x, b.y, tgt.x, tgt.y);
            const speed = 6.0;
            const projId = Math.random().toString();
            state.projectiles.push({
              id: projId,
              x: b.x,
              y: b.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              targetX: tgt.x,
              targetY: tgt.y,
              targetId: tgt.id,
              damage: b.damage,
              speed,
              player: b.player,
              splashRadius: 0,
              color: b.player === PlayerType.PLAYER ? '#38bdf8' : '#f43f5e',
              size: 4,
            });

            // Play firing sound
            if (b.player === PlayerType.PLAYER) {
              sound.playLaser();
            } else {
              // Only play if turret is close to player camera
              const dToCam = distance(b.x, b.y, state.camera.x + state.camera.width / 2, state.camera.y + state.camera.height / 2);
              if (dToCam < 600) {
                sound.playLaser();
              }
            }
            b.attackCooldown = b.type === BuildingType.TURRET ? 40 : 60;
          }
        }
      }

      // Construction increment
      if (!b.isComplete) {
        b.buildProgress += 0.25; // complete gradually
        b.hp = Math.min(b.maxHp, Math.floor((b.buildProgress / 100) * b.maxHp));
        if (b.buildProgress >= 100) {
          b.isComplete = true;
          b.hp = b.maxHp;
          if (b.player === PlayerType.PLAYER) {
            sound.playBuildComplete();
          }
        }
      }

      // Production queue increment
      if (b.isComplete && b.productionQueue.length > 0) {
        b.productionProgress += 0.45; // process training ticks
        if (b.productionProgress >= 100) {
          const type = b.productionQueue.shift();
          b.productionProgress = 0;
          if (type) {
            // Spawn unit near building base
            const spawnX = b.x + (Math.random() * 40 - 20);
            const spawnY = b.y + b.size + 15;
            const newU = createUnit(type, b.player, spawnX, spawnY);
            state.units.push(newU);

            if (b.player === PlayerType.PLAYER) {
              state.stats.unitsTrained++;
              sound.playBuildComplete();
            }
          }
        }
      }
    });

    // 5. Update Unit Behaviors (State Machines)
    state.units.forEach(u => {
      if (u.hp <= 0) return;

      // Attack cooldown timers
      if (u.attackCooldown > 0) u.attackCooldown--;

      // Apply Upgrade Buffs
      if (u.player === PlayerType.PLAYER) {
        if (state.upgrades.speedBoost) {
          u.speed = u.type === UnitType.WORKER ? 3.1 : u.type === UnitType.SOLDIER ? 2.5 : 1.7;
        }
      }

      // Auto Aggression: Combat units look for nearby targets if idle
      if (u.type !== UnitType.WORKER && u.state === UnitState.IDLE) {
        const sightRange = u.range + 80;
        const scan = findClosestEnemy({ x: u.x, y: u.y, player: u.player, range: sightRange }, state.units, state.buildings);
        if (scan) {
          u.state = UnitState.ATTACKING;
          u.targetId = scan.target.id;
        }
      }

      // Movement step
      if (u.targetX !== null && u.targetY !== null && u.state !== UnitState.ATTACKING) {
        const d = distance(u.x, u.y, u.targetX, u.targetY);
        const stopDistance = u.state === UnitState.MINING_GOING ? 15 : 4;

        if (d > stopDistance) {
          const angle = getAngle(u.x, u.y, u.targetX, u.targetY);
          u.angle = angle;
          
          // Step position
          u.x += Math.cos(angle) * u.speed;
          u.y += Math.sin(angle) * u.speed;
        } else {
          // Arrived at destination
          if (u.state === UnitState.MOVING) {
            u.state = UnitState.IDLE;
            u.targetX = null;
            u.targetY = null;
          } else if (u.state === UnitState.MINING_GOING) {
            // Arrived at gold mine crystal node
            u.state = UnitState.MINING_GATHERING;
            u.attackCooldown = 80; // 80 frames mining delay
            u.targetX = null;
            u.targetY = null;
          } else if (u.state === UnitState.MINING_RETURNING) {
            // Arrived at Command Center Base to deposit gold
            const depositAmount = u.carryAmount;
            u.carryAmount = 0;
            
            if (u.player === PlayerType.PLAYER) {
              const upgradeMultiplier = state.upgrades.fastGather ? 2.0 : 1.0;
              const gathered = Math.floor(depositAmount * upgradeMultiplier);
              const cType = u.carryType || ResourceType.GOLD;
              
              if (cType === ResourceType.GOLD) {
                state.resources.gold += gathered;
                state.minerals = state.resources.gold;
                state.stats.mineralsMined += gathered;
              } else if (cType === ResourceType.WOOD) {
                state.resources.wood += gathered;
              } else if (cType === ResourceType.STONE) {
                state.resources.stone += gathered;
              } else if (cType === ResourceType.IRON) {
                state.resources.iron += gathered;
              } else if (cType === ResourceType.COAL) {
                state.resources.coal += gathered;
              } else if (cType === ResourceType.OIL) {
                state.resources.oil += gathered;
              }
            } else {
              // AI gathers
              state.minerals += depositAmount;
            }

            // Spawn floating deposit particle indicators
            for (let i = 0; i < 4; i++) {
              state.particles.push({
                id: Math.random().toString(),
                x: u.x,
                y: u.y - 10,
                vx: (Math.random() - 0.5) * 1,
                vy: -Math.random() * 1.5 - 0.5,
                color: '#fbbf24',
                size: Math.random() * 2.5 + 1.5,
                alpha: 1.0,
                life: 30,
                maxLife: 30,
              });
            }

            // Auto loop back to mine crystal node again!
            if (u.targetId) {
              const node = state.mineralsNodes.find(n => n.id === u.targetId);
              if (node && node.amount > 0) {
                u.state = UnitState.MINING_GOING;
                u.targetX = node.x;
                u.targetY = node.y;
              } else {
                // look for new mineral
                const nextNode = findClosestResource(u, state.mineralsNodes);
                if (nextNode) {
                  u.targetId = nextNode.id;
                  u.state = UnitState.MINING_GOING;
                  u.targetX = nextNode.x;
                  u.targetY = nextNode.y;
                } else {
                  u.state = UnitState.IDLE;
                }
              }
            } else {
              u.state = UnitState.IDLE;
            }
          }
        }
      }

      // STATE MACHINE: Mining Progress
      if (u.state === UnitState.MINING_GATHERING) {
        if (u.attackCooldown > 0) {
          u.attackCooldown--;
          // Spawn sparkle dust
          if (state.gameTicks % 15 === 0) {
            state.particles.push({
              id: Math.random().toString(),
              x: u.x + (Math.random() * 10 - 5),
              y: u.y + (Math.random() * 10 - 5),
              vx: (Math.random() - 0.5) * 0.5,
              vy: -Math.random() * 0.8,
              color: '#facc15',
              size: Math.random() * 2.5 + 1,
              alpha: 1.0,
              life: 25,
              maxLife: 25,
            });
          }
        } else {
          // Miner has loaded cargo
          const targetNode = state.mineralsNodes.find(n => n.id === u.targetId);
          if (targetNode && targetNode.amount > 0) {
            targetNode.amount = Math.max(0, targetNode.amount - u.maxCarry);
            u.carryAmount = u.maxCarry;
            u.carryType = targetNode.resourceType;

            // Target nearest base Command Center
            const cc = findClosestCommandCenter(u, state.buildings);
            if (cc) {
              u.state = UnitState.MINING_RETURNING;
              u.targetX = cc.x;
              u.targetY = cc.y;
            } else {
              u.state = UnitState.IDLE; // nowhere to drop minerals!
            }
          } else {
            // mine empty, find another
            const nextNode = findClosestResource(u, state.mineralsNodes);
            if (nextNode) {
              u.targetId = nextNode.id;
              u.state = UnitState.MINING_GOING;
              u.targetX = nextNode.x;
              u.targetY = nextNode.y;
            } else {
              u.state = UnitState.IDLE;
            }
          }
        }
      }

      // STATE MACHINE: Combat Attacking Action
      if (u.state === UnitState.ATTACKING) {
        if (!u.targetId) {
          u.state = UnitState.IDLE;
          return;
        }

        // Target must be found and alive
        const targetUnit = state.units.find(x => x.id === u.targetId && x.hp > 0);
        const targetBldg = state.buildings.find(x => x.id === u.targetId && x.hp > 0);
        const target = targetUnit || targetBldg;

        if (!target) {
          // target dead, reset state
          u.state = UnitState.IDLE;
          u.targetId = null;
          return;
        }

        const dist = distance(u.x, u.y, target.x, target.y);
        const maxRange = u.range;

        if (dist > maxRange) {
          // Move closer
          const angle = getAngle(u.x, u.y, target.x, target.y);
          u.angle = angle;
          u.x += Math.cos(angle) * u.speed;
          u.y += Math.sin(angle) * u.speed;
        } else {
          // Within range: Stop and Shoot!
          u.angle = getAngle(u.x, u.y, target.x, target.y);
          
          if (u.attackCooldown <= 0) {
            u.attackCooldown = u.attackSpeed;

            // Spawn projectile
            const projId = Math.random().toString();
            const angle = u.angle;
            const speed = u.type === UnitType.HEAVY ? 5.0 : 7.0;
            state.projectiles.push({
              id: projId,
              x: u.x,
              y: u.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              targetX: target.x,
              targetY: target.y,
              targetId: target.id,
              damage: u.damage,
              speed,
              player: u.player,
              splashRadius: u.type === UnitType.HEAVY ? 25 : 0,
              color: u.player === PlayerType.PLAYER ? '#2dd4bf' : '#fb7185',
              size: u.type === UnitType.HEAVY ? 5.5 : 3,
            });

            // Play sound FX
            if (u.player === PlayerType.PLAYER) {
              if (u.type === UnitType.HEAVY) {
                sound.playHeavyCannon();
              } else {
                sound.playLaser();
              }
            } else {
              // Enemy attack sound if near player viewport
              const dToCam = distance(u.x, u.y, state.camera.x + state.camera.width / 2, state.camera.y + state.camera.height / 2);
              if (dToCam < 650) {
                if (u.type === UnitType.HEAVY) sound.playHeavyCannon();
                else sound.playLaser();
              }
            }
          }
        }
      }
    });

    // 6. Handle Unit Separation Physics
    handleSeparation(state.units);

    // 7. Cleanup Dead Entities
    state.units = state.units.filter(u => {
      if (u.hp <= 0) {
        // explosion dust
        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = Math.random() * 2;
          state.particles.push({
            id: Math.random().toString(),
            x: u.x,
            y: u.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            color: '#ef4444',
            size: Math.random() * 3 + 1,
            alpha: 1.0,
            life: Math.random() * 15 + 10,
            maxLife: 25,
          });
        }
        return false;
      }
      return true;
    });

    // Handle building collapse
    state.buildings = state.buildings.filter(b => {
      if (b.hp <= 0) {
        // Big explosion!
        sound.playExplosion();
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = Math.random() * 4 + 1;
          state.particles.push({
            id: Math.random().toString(),
            x: b.x,
            y: b.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            color: '#f97316',
            size: Math.random() * 5 + 2,
            alpha: 1.0,
            life: Math.random() * 40 + 20,
            maxLife: 60,
          });
        }

        // Game Over Conditions check
        if (b.type === BuildingType.COMMAND_CENTER) {
          if (b.player === PlayerType.PLAYER) {
            onGameOver(false, state.stats); // Player defeated
          } else {
            onGameOver(true, state.stats); // Player won!
          }
        }
        return false;
      }
      return true;
    });

    // 8. Enemy AI Director Logic (Simulating intelligent Base building & raiding waves)
    if (state.gameTicks % 120 === 0) {
      runEnemyCommanderAI();
    }

    // Decrement wave raid timer
    if (state.aiAttackCooldown > 0) {
      state.aiAttackCooldown--;
    } else {
      // TRIGGER raid attack wave!
      launchEnemyAIAttackWave();
      state.aiAttackCooldown = state.aiMaxAttackCooldown;
    }
  };

  // Simulated Clever Enemy Commander AI
  const runEnemyCommanderAI = () => {
    const state = stateRef.current;
    
    // Check available enemy units & buildings
    const enemyWorkers = state.units.filter(u => u.player === PlayerType.ENEMY && u.type === UnitType.WORKER);
    const enemyCombat = state.units.filter(u => u.player === PlayerType.ENEMY && u.type !== UnitType.WORKER);
    const enemyCC = state.buildings.find(b => b.player === PlayerType.ENEMY && b.type === BuildingType.COMMAND_CENTER && b.hp > 0);
    const enemyBarracks = state.buildings.find(b => b.player === PlayerType.ENEMY && b.type === BuildingType.BARRACKS && b.hp > 0);

    if (!enemyCC) return; // base destroyed

    // 1. Maintain worker production (Ensure we have 4-5 active miners)
    const workerCap = difficulty === 'HARD' ? 6 : difficulty === 'EASY' ? 3 : 4;
    if (enemyWorkers.length < workerCap && enemyCC.productionQueue.length < 2) {
      enemyCC.productionQueue.push(UnitType.WORKER);
    }

    // Auto assign idle enemy workers to nearest mineral crystal node
    enemyWorkers.forEach(w => {
      if (w.state === UnitState.IDLE) {
        const node = findClosestResource(w, state.mineralsNodes);
        if (node) {
          w.state = UnitState.MINING_GOING;
          w.targetId = node.id;
          w.targetX = node.x;
          w.targetY = node.y;
        }
      }
    });

    // 2. Build or construct defense turrets if base has plenty of resources
    // In our simplified engine, the AI can build a barracks if none exists
    if (!enemyBarracks && state.gameTicks > 600) {
      // Spawn Barracks at offset
      const bx = enemyCC.x - 100;
      const by = enemyCC.y + 120;
      state.buildings.push(createBuilding(BuildingType.BARRACKS, PlayerType.ENEMY, bx, by, true));
    }

    // 3. Train soldiers & heavies from barracks
    if (enemyBarracks && enemyBarracks.productionQueue.length < 3) {
      // Alternates training Soldiers & Heavies based on difficulty
      const combatCap = difficulty === 'HARD' ? 12 : difficulty === 'EASY' ? 4 : 8;
      if (enemyCombat.length < combatCap) {
        const typeToTrain = Math.random() > 0.65 ? UnitType.HEAVY : UnitType.SOLDIER;
        enemyBarracks.productionQueue.push(typeToTrain);
      }
    }
  };

  // Launch aggressive raid against player's Command Center
  const launchEnemyAIAttackWave = () => {
    const state = stateRef.current;
    
    // Gather all enemy combat soldiers on map
    const attackRaidForce = state.units.filter(u => u.player === PlayerType.ENEMY && u.type !== UnitType.WORKER);
    
    if (attackRaidForce.length === 0) return;

    // Target the player's primary Command Center
    const playerBase = state.buildings.find(b => b.player === PlayerType.PLAYER && b.type === BuildingType.COMMAND_CENTER && b.hp > 0);
    
    if (!playerBase) return;

    attackRaidForce.forEach(u => {
      // Order them to march aggressively to player base center
      u.state = UnitState.ATTACKING;
      u.targetId = playerBase.id;
      u.targetX = playerBase.x + (Math.random() * 60 - 30);
      u.targetY = playerBase.y + (Math.random() * 60 - 30);
    });

    // Set alarm triggers
    state.alertTimer = 360; // 6 seconds alarm flashing
    sound.playAlarm();
  };

  // Custom Upgrade handlers
  const handleUpgradeBuy = (type: 'fastGather' | 'speedBoost') => {
    const cost = type === 'fastGather' ? 150 : 200;
    if (minerals >= cost) {
      stateRef.current.minerals -= cost;
      
      const nextUpgrades = { ...upgrades, [type]: true };
      setUpgrades(nextUpgrades);
      stateRef.current.upgrades[type] = true;

      sound.playBuildComplete();
    } else {
      // Show error sound
      sound.playSelect();
    }
  };

  const handleUpdateWorkerAssignments = (newAssignments: typeof workerAssignments) => {
    stateRef.current.workerAssignments = newAssignments;
    setWorkerAssignments(newAssignments);
  };

  const handleUpdateRelation = (factionId: string, delta: number) => {
    const state = stateRef.current;
    const fac = state.factions.find(f => f.id === factionId);
    if (!fac) return;

    fac.relation = Math.max(0, Math.min(100, fac.relation + delta));
    const oldStatus = fac.status;
    
    if (fac.relation >= 70) {
      fac.status = 'ALLY';
    } else if (fac.relation <= 30) {
      fac.status = 'WAR';
    } else {
      fac.status = 'NEUTRAL';
    }

    if (fac.status === 'WAR' && oldStatus !== 'WAR') {
      sound.playAlarm();
      state.units.forEach(u => {
        if (u.factionId === factionId) {
          u.player = PlayerType.ENEMY;
        }
      });
      state.buildings.forEach(b => {
        if (b.factionId === factionId) {
          b.player = PlayerType.ENEMY;
        }
      });
    } else if (fac.status !== 'WAR' && oldStatus === 'WAR') {
      state.units.forEach(u => {
        if (u.factionId === factionId) {
          u.player = PlayerType.NEUTRAL;
        }
      });
      state.buildings.forEach(b => {
        if (b.factionId === factionId) {
          b.player = PlayerType.NEUTRAL;
        }
      });
    }

    setMinerals(state.resources.gold);
    setResources({ ...state.resources });
    setFactions([...state.factions]);
  };

  // Quick select troop shortcuts
  const selectAllCombatTroops = () => {
    const state = stateRef.current;
    state.units.forEach(u => {
      u.selected = (u.player === PlayerType.PLAYER && u.type !== UnitType.WORKER);
    });
    sound.playSelect();
  };

  const selectAllWorkers = () => {
    const state = stateRef.current;
    state.units.forEach(u => {
      u.selected = (u.player === PlayerType.PLAYER && u.type === UnitType.WORKER);
    });
    sound.playSelect();
  };

  const clearSelection = () => {
    const state = stateRef.current;
    state.units.forEach(u => { u.selected = false; });
    stateRef.current.selectedBuildingId = null;
    sound.playSelect();
  };

  // Core Game Canvas Render Pipeline (HTML5 Canvas Rendering)
  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    const cam = state.camera;

    // Clear Screen
    ctx.fillStyle = '#0f172a'; // outer boundary dark
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Translate view matrix by Camera Viewport coordinate offsets
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // 1. Draw Map Battlefield Floor Grid
    ctx.fillStyle = '#061a12'; // deep mossy tactical battlefield color
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Draw grid lines
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAP_SIZE; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_SIZE; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_SIZE, y);
      ctx.stroke();
    }

    // Map boundaries red glow borders
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

    // 2. Draw Mineral Nodes (Gold/Amber Crystal Formations)
    state.mineralsNodes.forEach(node => {
      if (node.amount <= 0) return;

      // Draw crystal cluster gradient glow
      const radialGlow = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, node.size * 2);
      radialGlow.addColorStop(0, 'rgba(234, 179, 8, 0.45)');
      radialGlow.addColorStop(1, 'rgba(234, 179, 8, 0.0)');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size * 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw multifaceted crystalline structure
      ctx.fillStyle = '#facc15'; // core gold yellow
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(node.x, node.y - node.size);
      ctx.lineTo(node.x + node.size * 0.8, node.y - node.size * 0.3);
      ctx.lineTo(node.x + node.size * 0.5, node.y + node.size * 0.7);
      ctx.lineTo(node.x - node.size * 0.5, node.y + node.size * 0.7);
      ctx.lineTo(node.x - node.size * 0.8, node.y - node.size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Facets inside crystal for lovely visual realism
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y - node.size);
      ctx.lineTo(node.x, node.y + node.size * 0.7);
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(node.x + node.size * 0.8, node.y - node.size * 0.3);
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(node.x - node.size * 0.8, node.y - node.size * 0.3);
      ctx.stroke();

      // Display remaining gold amount
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${node.amount}`, node.x, node.y - node.size - 5);
    });

    // 3. Draw Buildings
    state.buildings.forEach(b => {
      // Selection ring under building
      if (b.id === state.selectedBuildingId) {
        ctx.strokeStyle = b.player === PlayerType.PLAYER ? '#2dd4bf' : '#f43f5e';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash
      }

      // Draw building base structure
      ctx.fillStyle = b.player === PlayerType.PLAYER ? '#0f766e' : '#991b1b'; // team primary color
      ctx.strokeStyle = b.player === PlayerType.PLAYER ? '#2dd4bf' : '#f43f5e'; // team glow outline
      ctx.lineWidth = b.isComplete ? 3.5 : 1.5;

      if (!b.isComplete) {
        ctx.fillStyle = '#334155'; // gray scaffolding while constructing
      }

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Interior technical detail graphics
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Specific building designs
      if (b.type === BuildingType.COMMAND_CENTER) {
        // Draw rotating radar dish line
        const radarAngle = (state.gameTicks * 0.02) % (Math.PI * 2);
        ctx.strokeStyle = b.player === PlayerType.PLAYER ? '#5eead4' : '#fda4af';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(radarAngle) * (b.size * 0.5), b.y + Math.sin(radarAngle) * (b.size * 0.5));
        ctx.stroke();

        // Central beacon square
        ctx.fillStyle = b.player === PlayerType.PLAYER ? '#14b8a6' : '#f43f5e';
        ctx.fillRect(b.x - 6, b.y - 6, 12, 12);
      } else if (b.type === BuildingType.BARRACKS) {
        // Cross swords sign or geometric military hanger stripes
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 4;
        ctx.strokeRect(b.x - b.size * 0.4, b.y - b.size * 0.4, b.size * 0.8, b.size * 0.8);
      } else if (b.type === BuildingType.TURRET) {
        // Find defense gun rotation target
        const scan = findClosestEnemy({ x: b.x, y: b.y, player: b.player, range: b.attackRange }, state.units, state.buildings);
        const aimAngle = scan ? getAngle(b.x, b.y, scan.target.x, scan.target.y) : (state.gameTicks * 0.005) % (Math.PI * 2);

        // Draw gun barrel rotating
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(aimAngle) * (b.size * 1.4), b.y + Math.sin(aimAngle) * (b.size * 1.4));
        ctx.stroke();
      } else if (b.type === BuildingType.HOUSE) {
        // Draw standard geometric house shape/pattern inside
        ctx.strokeStyle = b.player === PlayerType.PLAYER ? '#2dd4bf' : '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - b.size * 0.4);
        ctx.lineTo(b.x + b.size * 0.45, b.y - b.size * 0.05);
        ctx.lineTo(b.x + b.size * 0.45, b.y + b.size * 0.45);
        ctx.lineTo(b.x - b.size * 0.45, b.y + b.size * 0.45);
        ctx.lineTo(b.x - b.size * 0.45, b.y - b.size * 0.05);
        ctx.closePath();
        ctx.stroke();
      }

      // Building Name and HP text
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10.5px Inter';
      ctx.textAlign = 'center';
      const label = b.type === BuildingType.COMMAND_CENTER 
        ? 'HQ' 
        : b.type === BuildingType.BARRACKS 
          ? 'BARRACKS' 
          : b.type === BuildingType.TURRET 
            ? 'TURRET' 
            : 'HOUSE';
      ctx.fillText(label, b.x, b.y - b.size - 8);

      // HP Bar
      const hpPercent = b.hp / b.maxHp;
      const barW = b.size * 1.5;
      ctx.fillStyle = '#ef4444'; // Red negative
      ctx.fillRect(b.x - barW / 2, b.y + b.size + 6, barW, 4.5);
      ctx.fillStyle = '#22c55e'; // Green health
      ctx.fillRect(b.x - barW / 2, b.y + b.size + 6, barW * hpPercent, 4.5);
    });

    // 4. Draw Units
    state.units.forEach(u => {
      // Draw selection shadow circle under selected units
      if (u.selected) {
        ctx.fillStyle = 'rgba(45, 212, 191, 0.22)';
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.size + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Base Unit circle body
      ctx.fillStyle = u.player === PlayerType.PLAYER ? '#14b8a6' : '#e11d48'; // electric cyan vs rose crimson
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.size, 0, Math.PI * 2);
      ctx.fill();

      // Draw direction gun/pointer
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(u.x + Math.cos(u.angle) * (u.size + 3), u.y + Math.sin(u.angle) * (u.size + 3));
      ctx.stroke();

      // Specific unit decor
      if (u.type === UnitType.WORKER) {
        // Wrench accessory
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.size * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        // Draw carried gold crystal on back
        if (u.carryAmount > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(u.x - 3, u.y - 12, 6, 6);
        }
      } else if (u.type === UnitType.HEAVY) {
        // Double turret tracks decor
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(u.x - 12, u.y - 12, 24, 24);
      }

      // Unit health bar (only drawn if selected or injured to keep screen clean and pretty)
      const isInjured = u.hp < u.maxHp;
      if (u.selected || isInjured) {
        const hpPercent = u.hp / u.maxHp;
        const barW = u.size * 2;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.fillRect(u.x - barW / 2, u.y - u.size - 7, barW, 3);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
        ctx.fillRect(u.x - barW / 2, u.y - u.size - 7, barW * hpPercent, 3);
      }
    });

    // 5. Draw Projectiles
    state.projectiles.forEach(proj => {
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Draw Particles
    state.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // reset transparency

    // 7. Draw Expanding Action Command Ripples (Green target nodes)
    state.visualRipples.forEach(r => {
      ctx.strokeStyle = '#2dd4bf';
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1.0; // reset

    // 8. Draw selection drag box overlay (While dragging in Select Mode)
    const box = state.selectionBox;
    if (box && box.start && box.current) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      
      const x1 = box.start.x;
      const y1 = box.start.y;
      const x2 = box.current.x;
      const y2 = box.current.y;

      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    // 9. Draw Footprint of structure we are currently planning to build
    if (isPlacingBuilding) {
      const mouseMap = state.lastMouseMapPos;
      const bType = isPlacingBuilding;
      const cost = getBuildingCost(bType).minerals;
      const canAfford = state.minerals >= cost;

      ctx.fillStyle = canAfford ? 'rgba(45, 212, 191, 0.28)' : 'rgba(239, 68, 68, 0.28)';
      ctx.strokeStyle = canAfford ? '#2dd4bf' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      const size = bType === BuildingType.COMMAND_CENTER 
        ? 55 
        : bType === BuildingType.BARRACKS 
          ? 45 
          : bType === BuildingType.HOUSE 
            ? 35 
            : 30;
      ctx.beginPath();
      ctx.arc(mouseMap.x, mouseMap.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore(); // restore translated matrix

    // 10. DRAW TACTICAL MINIMAP in the corner (Static over absolute matrix translation)
    renderMinimap();
  };

  // Draw tactical minimap hud overlay
  const renderMinimap = () => {
    const mini = minimapRef.current;
    if (!mini) return;

    const ctx = mini.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    const cam = state.camera;

    // Clear Minimap background
    ctx.fillStyle = '#022c22'; // deep green forest map shadow
    ctx.fillRect(0, 0, mini.width, mini.height);

    const scale = mini.width / MAP_SIZE; // e.g. 120 / 1600 = 0.075

    // Draw Minerals
    ctx.fillStyle = '#eab308';
    state.mineralsNodes.forEach(node => {
      if (node.amount <= 0) return;
      ctx.fillRect(node.x * scale - 1.5, node.y * scale - 1.5, 3, 3);
    });

    // Draw Buildings (Large dots)
    state.buildings.forEach(b => {
      ctx.fillStyle = b.player === PlayerType.PLAYER ? '#2dd4bf' : '#f43f5e';
      const size = b.type === BuildingType.COMMAND_CENTER ? 6.5 : 4.5;
      ctx.beginPath();
      ctx.arc(b.x * scale, b.y * scale, size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Units (Tiny dots)
    state.units.forEach(u => {
      ctx.fillStyle = u.player === PlayerType.PLAYER ? '#38bdf8' : '#e11d48';
      ctx.fillRect(u.x * scale - 1, u.y * scale - 1, 2, 2);
    });

    // Draw Camera Sight Rectangle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cam.x * scale, cam.y * scale, cam.width * scale, cam.height * scale);
  };

  // Handle Minimap Click / Tap coordinate jumps
  const handleMinimapInteraction = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const mini = minimapRef.current;
    if (!mini) return;

    const rect = mini.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const scale = MAP_SIZE / mini.width;
    const targetMapX = x * scale;
    const targetMapY = y * scale;

    const cam = stateRef.current.camera;

    // Center camera viewport there
    stateRef.current.camera.x = Math.max(0, Math.min(MAP_SIZE - cam.width, targetMapX - cam.width / 2));
    stateRef.current.camera.y = Math.max(0, Math.min(MAP_SIZE - cam.height, targetMapY - cam.height / 2));
    
    sound.playSelect();
  };

  // Main Canvas Gestures Handler
  const getMapCoordinatesFromEvent = (clientX: number, clientY: number): Position => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return {
      x: x + stateRef.current.camera.x,
      y: y + stateRef.current.camera.y,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const mapPos = getMapCoordinatesFromEvent(e.clientX, e.clientY);
    handleInputStart(mapPos, e.button === 0, e.clientX, e.clientY);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const mapPos = getMapCoordinatesFromEvent(touch.clientX, touch.clientY);
    handleInputStart(mapPos, true, touch.clientX, touch.clientY);
  };

  const handleInputStart = (mapPos: Position, isPrimary: boolean, screenX: number, screenY: number) => {
    const state = stateRef.current;
    state.lastMouseMapPos = mapPos;

    // 1. If currently putting a building footprint down, place it on left click / touch!
    if (isPlacingBuilding && isPrimary) {
      handlePlaceBuildingAt(mapPos);
      return;
    }

    // 2. Mouse wheel drag / Right-click or touch panning state
    if (touchMode === 'PAN' || !isPrimary) {
      state.isPanning = true;
      state.panStart = { x: screenX, y: screenY };
    } else {
      // 3. Selection Box Start or Tap command
      state.selectionBox = {
        start: mapPos,
        current: mapPos,
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const mapPos = getMapCoordinatesFromEvent(e.clientX, e.clientY);
    handleInputMove(mapPos, e.clientX, e.clientY);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const mapPos = getMapCoordinatesFromEvent(touch.clientX, touch.clientY);
    handleInputMove(mapPos, touch.clientX, touch.clientY);
  };

  const handleInputMove = (mapPos: Position, screenX: number, screenY: number) => {
    const state = stateRef.current;
    state.lastMouseMapPos = mapPos;

    // 1. View Panning scroll viewport
    if (state.isPanning && state.panStart) {
      const dx = screenX - state.panStart.x;
      const dy = screenY - state.panStart.y;

      state.camera.x = Math.max(0, Math.min(MAP_SIZE - state.camera.width, state.camera.x - dx));
      state.camera.y = Math.max(0, Math.min(MAP_SIZE - state.camera.height, state.camera.y - dy));

      state.panStart = { x: screenX, y: screenY };
    }

    // 2. Update box select
    if (state.selectionBox) {
      state.selectionBox.current = mapPos;
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleInputEnd(e.clientX, e.clientY, e.button === 0);
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // If we have touches left, ignore
    handleInputEnd(0, 0, true);
  };

  const handleInputEnd = (screenX: number, screenY: number, isPrimary: boolean) => {
    const state = stateRef.current;
    state.isPanning = false;

    // Complete box selection
    const box = state.selectionBox;
    if (box && box.start && box.current) {
      const distDragged = distance(box.start.x, box.start.y, box.current.x, box.current.y);

      if (distDragged > 15) {
        // Evaluate selection box boundaries in map space
        const left = Math.min(box.start.x, box.current.x);
        const right = Math.max(box.start.x, box.current.x);
        const top = Math.min(box.start.y, box.current.y);
        const bottom = Math.max(box.start.y, box.current.y);

        // Deselect previous
        state.units.forEach(u => { u.selected = false; });
        state.selectedBuildingId = null;

        // Select player units inside box
        let selectedCount = 0;
        state.units.forEach(u => {
          if (u.player === PlayerType.PLAYER && u.hp > 0) {
            if (u.x >= left && u.x <= right && u.y >= top && u.y <= bottom) {
              u.selected = true;
              selectedCount++;
            }
          }
        });

        if (selectedCount > 0) {
          sound.playSelect();
        }
      } else {
        // Quick Tap action inside Map
        handleQuickTapAt(box.start, isPrimary);
      }
    }

    state.selectionBox = null;
  };

  // Perform quick tap action at precise location (issue moves / gather / combat targets)
  const handleQuickTapAt = (tapPos: Position, isPrimary: boolean) => {
    const state = stateRef.current;

    // Check if we clicked on any building to select it
    let clickedBldgId: string | null = null;
    for (const b of state.buildings) {
      if (b.hp > 0 && distance(tapPos.x, tapPos.y, b.x, b.y) <= b.size) {
        clickedBldgId = b.id;
        break;
      }
    }

    if (clickedBldgId) {
      // De-select units, select building instead
      state.units.forEach(u => { u.selected = false; });
      state.selectedBuildingId = clickedBldgId;
      sound.playSelect();
      return;
    }

    // Check if we tapped a mineral node
    let tappedMineralId: string | null = null;
    let tappedMineralNode: ResourceNode | null = null;
    for (const n of state.mineralsNodes) {
      if (n.amount > 0 && distance(tapPos.x, tapPos.y, n.x, n.y) <= n.size + 15) {
        tappedMineralId = n.id;
        tappedMineralNode = n;
        break;
      }
    }

    // Check if we tapped an enemy unit or building to attack
    let tappedEnemyId: string | null = null;
    let tappedEnemyType: 'unit' | 'building' | null = null;
    let tappedEnemyTarget: any = null;

    for (const u of state.units) {
      if (u.player === PlayerType.ENEMY && u.hp > 0 && distance(tapPos.x, tapPos.y, u.x, u.y) <= u.size + 12) {
        tappedEnemyId = u.id;
        tappedEnemyType = 'unit';
        tappedEnemyTarget = u;
        break;
      }
    }

    if (!tappedEnemyId) {
      for (const b of state.buildings) {
        if (b.player === PlayerType.ENEMY && b.hp > 0 && distance(tapPos.x, tapPos.y, b.x, b.y) <= b.size + 12) {
          tappedEnemyId = b.id;
          tappedEnemyType = 'building';
          tappedEnemyTarget = b;
          break;
        }
      }
    }

    // Gather currently selected units
    const activeSelectedUnits = state.units.filter(u => u.selected && u.hp > 0 && u.player === PlayerType.PLAYER);

    if (activeSelectedUnits.length > 0) {
      // 1. Mining Order
      if (tappedMineralId && tappedMineralNode) {
        activeSelectedUnits.forEach(u => {
          if (u.type === UnitType.WORKER) {
            u.state = UnitState.MINING_GOING;
            u.targetId = tappedMineralId;
            u.targetX = tappedMineralNode!.x;
            u.targetY = tappedMineralNode!.y;
          }
        });
        sound.playCommand();
        // Visual ripple confirmation
        state.visualRipples.push({ x: tapPos.x, y: tapPos.y, radius: 2, maxRadius: 28, alpha: 1.0 });
      } 
      // 2. Attack target Order
      else if (tappedEnemyId && tappedEnemyTarget) {
        activeSelectedUnits.forEach(u => {
          u.state = UnitState.ATTACKING;
          u.targetId = tappedEnemyId;
          // set target coordinate to go there
          u.targetX = tappedEnemyTarget!.x;
          u.targetY = tappedEnemyTarget!.y;
        });
        sound.playCommand();
        state.visualRipples.push({ x: tapPos.x, y: tapPos.y, radius: 2, maxRadius: 28, alpha: 1.0 });
      } 
      // 3. Move target location Order
      else {
        activeSelectedUnits.forEach(u => {
          u.state = UnitState.MOVING;
          u.targetX = tapPos.x + (Math.random() * 40 - 20); // soft offset to prevent overlap
          u.targetY = tapPos.y + (Math.random() * 40 - 20);
          u.targetId = null;
        });
        sound.playCommand();
        state.visualRipples.push({ x: tapPos.x, y: tapPos.y, radius: 2, maxRadius: 28, alpha: 1.0 });
      }
    } else {
      // Tap on empty space with no selected units: de-select everything
      state.units.forEach(u => { u.selected = false; });
      state.selectedBuildingId = null;
    }
  };

  // Place newly purchased structure footprint
  const handlePlaceBuildingAt = (mapPos: Position) => {
    const state = stateRef.current;
    if (!isPlacingBuilding) return;

    const bType = isPlacingBuilding;
    const cost = getBuildingCost(bType).minerals;

    if (state.minerals < cost) {
      const t = translations[language];
      setErrorMessage(t.notEnoughMinerals);
      setTimeout(() => setErrorMessage(null), 2500);
      setIsPlacingBuilding(null);
      return;
    }

    // Check prerequisites
    const prereq = checkPrerequisites(bType, state.buildings);
    if (!prereq.satisfied) {
      const t = translations[language];
      const errMsg = (t as any)[prereq.errorKey] || prereq.errorKey;
      setErrorMessage(errMsg);
      setTimeout(() => setErrorMessage(null), 2500);
      setIsPlacingBuilding(null);
      sound.playSelect();
      return;
    }

    // Check collision with resources and other buildings to ensure valid placement coordinates!
    let valid = true;
    
    // Can't build too close to resource mineral nodes
    state.mineralsNodes.forEach(node => {
      if (distance(mapPos.x, mapPos.y, node.x, node.y) < node.size + 60) {
        valid = false;
      }
    });

    // Can't build on top of existing buildings
    state.buildings.forEach(b => {
      if (distance(mapPos.x, mapPos.y, b.x, b.y) < b.size + 45) {
        valid = false;
      }
    });

    if (valid) {
      // Deduct mineral gold
      state.minerals -= cost;
      
      // Spawn building in incomplete state
      state.buildings.push(createBuilding(bType, PlayerType.PLAYER, mapPos.x, mapPos.y, false));
      state.stats.buildingsBuilt++;
      
      setIsPlacingBuilding(null);
      sound.playCommand();
    } else {
      sound.playSelect(); // invalid place feedback sound
    }
  };

  const checkPrerequisites = (type: BuildingType, buildings: Building[]): { satisfied: boolean; errorKey: string } => {
    const hasCC = buildings.some(b => b.player === PlayerType.PLAYER && b.type === BuildingType.COMMAND_CENTER && b.isComplete && b.hp > 0);
    const hasHouse = buildings.some(b => b.player === PlayerType.PLAYER && b.type === BuildingType.HOUSE && b.isComplete && b.hp > 0);
    const hasBarracks = buildings.some(b => b.player === PlayerType.PLAYER && b.type === BuildingType.BARRACKS && b.isComplete && b.hp > 0);

    if (type === BuildingType.HOUSE) {
      if (!hasCC) {
        return { satisfied: false, errorKey: 'ccRequired' };
      }
    } else if (type === BuildingType.BARRACKS) {
      if (!hasCC) {
        return { satisfied: false, errorKey: 'ccRequired' };
      }
      if (!hasHouse) {
        return { satisfied: false, errorKey: 'notEnoughPopulation' };
      }
    } else if (type === BuildingType.TURRET) {
      if (!hasCC) {
        return { satisfied: false, errorKey: 'ccRequired' };
      }
      if (!hasBarracks) {
        return { satisfied: false, errorKey: 'barracksRequired' };
      }
    }
    return { satisfied: true, errorKey: '' };
  };

  const handleBuildSelect = (type: BuildingType) => {
    const state = stateRef.current;
    const cost = getBuildingCost(type).minerals;

    if (state.minerals < cost) {
      const t = translations[language];
      setErrorMessage(t.notEnoughMinerals);
      setTimeout(() => setErrorMessage(null), 2500);
      sound.playSelect();
      return;
    }

    // Check prerequisites
    const prereq = checkPrerequisites(type, state.buildings);
    if (!prereq.satisfied) {
      const t = translations[language];
      const errMsg = (t as any)[prereq.errorKey] || prereq.errorKey;
      setErrorMessage(errMsg);
      setTimeout(() => setErrorMessage(null), 2500);
      sound.playSelect();
      return;
    }

    setIsPlacingBuilding(type);
    sound.playSelect();
  };

  // Train troops from Barracks queue
  const handleTrainUnit = (type: UnitType) => {
    const state = stateRef.current;
    const bldg = state.buildings.find(b => b.id === state.selectedBuildingId);
    if (!bldg || !bldg.isComplete) return;

    if (bldg.productionQueue.length >= 5) {
      const t = translations[language];
      setErrorMessage(t.trainingQueueFull);
      setTimeout(() => setErrorMessage(null), 2500);
      sound.playSelect();
      return;
    }

    // Check population limits!
    const activeUnits = state.units.filter(u => u.player === PlayerType.PLAYER && u.hp > 0).length;
    let enqueuedUnits = 0;
    state.buildings.forEach(b => {
      if (b.player === PlayerType.PLAYER && b.hp > 0) {
        enqueuedUnits += b.productionQueue.length;
      }
    });

    const playerHouses = state.buildings.filter(b => b.player === PlayerType.PLAYER && b.type === BuildingType.HOUSE && b.isComplete && b.hp > 0).length;
    const playerCCs = state.buildings.filter(b => b.player === PlayerType.PLAYER && b.type === BuildingType.COMMAND_CENTER && b.isComplete && b.hp > 0).length;
    const maxCap = Math.min(50, 5 + (playerCCs * 10) + (playerHouses * 5));

    if (activeUnits + enqueuedUnits >= maxCap) {
      const t = translations[language];
      setErrorMessage(t.notEnoughPopulation);
      setTimeout(() => setErrorMessage(null), 2500);
      sound.playSelect();
      return;
    }

    const cost = getUnitCost(type).minerals;
    if (state.minerals >= cost) {
      state.minerals -= cost;
      bldg.productionQueue.push(type);
      sound.playSelect();
    } else {
      const t = translations[language];
      setErrorMessage(t.notEnoughMinerals);
      setTimeout(() => setErrorMessage(null), 2500);
      sound.playSelect();
    }
  };

  return (
    <div className="relative w-screen h-screen bg-slate-900 select-none overflow-hidden flex flex-col">
      {/* 1. Main Interactive Game Canvas wrapper */}
      <div 
        ref={containerRef} 
        className="w-full h-full relative cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 block w-full h-full touch-none"
        />

        {/* 2. Tactical HUD Minimap (Absolute positioned bottom right) */}
        <div 
          id="minimap-container"
          className="absolute bottom-4 right-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-2xl z-20 pointer-events-auto flex flex-col gap-1 items-center"
        >
          <canvas
            ref={minimapRef}
            width={125}
            height={125}
            onMouseDown={handleMinimapInteraction}
            onTouchStart={handleMinimapInteraction}
            onTouchMove={handleMinimapInteraction}
            onContextMenu={(e) => e.preventDefault()}
            className="w-[125px] h-[125px] rounded-lg border border-slate-800 cursor-pointer block touch-none"
          />
          <div className="text-[9px] text-slate-500 font-mono tracking-wider flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 text-rose-500" />
            <span>RADAR MINIMAP</span>
          </div>
        </div>

        {/* 3. Main floating HUD UI Panel Overlay */}
        <GameUI
          language={language}
          minerals={minerals}
          selectedUnits={selectedUnits}
          selectedBuilding={selectedBuilding}
          touchMode={touchMode}
          setTouchMode={setTouchMode}
          onSelectAllCombat={selectAllCombatTroops}
          onSelectAllWorkers={selectAllWorkers}
          onClearSelection={clearSelection}
          onBuildSelect={handleBuildSelect}
          onTrainUnit={handleTrainUnit}
          onBackToMenu={onBackToMenu}
          soundEnabled={sound.isEnabled()}
          onToggleSound={() => {
            const next = !sound.isEnabled();
            sound.setEnabled(next);
            sound.playSelect();
          }}
          isPlacingBuilding={isPlacingBuilding}
          cancelBuildingPlacement={() => setIsPlacingBuilding(null)}
          underAttackAlert={underAttackAlert}
          enemyAttackTimer={enemyAttackTimer}
          difficulty={difficulty}
          upgrades={upgrades}
          onBuyUpgrade={handleUpgradeBuy}
          currentPopulation={currentPopulation}
          maxPopulation={maxPopulation}
          errorMessage={errorMessage}
          onClearErrorMessage={() => setErrorMessage(null)}
          
          resources={resources}
          factions={factions}
          workerAssignments={workerAssignments}
          onUpdateWorkerAssignments={handleUpdateWorkerAssignments}
          onUpdateRelation={handleUpdateRelation}
        />
      </div>
    </div>
  );
}
