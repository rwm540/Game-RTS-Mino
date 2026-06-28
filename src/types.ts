/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PlayerType {
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY',
  NEUTRAL = 'NEUTRAL'
}

export enum ResourceType {
  GOLD = 'GOLD',
  WOOD = 'WOOD',
  STONE = 'STONE',
  IRON = 'IRON',
  COAL = 'COAL',
  OIL = 'OIL'
}

export enum UnitType {
  WORKER = 'WORKER',
  SOLDIER = 'SOLDIER',
  HEAVY = 'HEAVY'
}

export enum BuildingType {
  COMMAND_CENTER = 'COMMAND_CENTER',
  BARRACKS = 'BARRACKS',
  TURRET = 'TURRET',
  HOUSE = 'HOUSE',
  WEAPONS_FACTORY = 'WEAPONS_FACTORY',
  AMMO_FACTORY = 'AMMO_FACTORY',
  TANK_FACTORY = 'TANK_FACTORY'
}

export enum UnitState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  MINING_GOING = 'MINING_GOING',
  MINING_GATHERING = 'MINING_GATHERING',
  MINING_RETURNING = 'MINING_RETURNING',
  ATTACK_MOVE = 'ATTACK_MOVE',
  ATTACKING = 'ATTACKING'
}

export interface Position {
  x: number;
  y: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  player: PlayerType;
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  targetId: string | null; // Targets can be ResourceNode or Unit or Building
  hp: number;
  maxHp: number;
  state: UnitState;
  speed: number;
  range: number;
  damage: number;
  attackCooldown: number; // in ticks or ms
  attackSpeed: number; // ticks per shot
  size: number;
  carryAmount: number;
  maxCarry: number;
  carryType?: ResourceType;
  selected?: boolean;
  angle: number; // for smooth rotation rendering
  path?: Position[]; // waypoint path
  cost: { minerals: number };
  buildTime: number; // in frames/ticks
  killCount: number;
  factionId?: string;
  role?: ResourceType;
}

export interface Building {
  id: string;
  type: BuildingType;
  player: PlayerType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  size: number;
  isComplete: boolean;
  buildProgress: number; // 0 to 100
  productionQueue: UnitType[];
  productionProgress: number; // 0 to 100
  cost: { minerals: number };
  buildTime: number; // in frames/ticks
  attackCooldown: number;
  attackRange: number;
  damage: number;
  factionId?: string;
}

export interface ResourceNode {
  id: string;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
  size: number;
  resourceType: ResourceType;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  targetId: string | null;
  damage: number;
  speed: number;
  player: PlayerType;
  splashRadius: number;
  color: string;
  size: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface GameStats {
  mineralsMined: number;
  unitsTrained: number;
  unitsLost: number;
  unitsKilled: number;
  buildingsBuilt: number;
  buildingsDestroyed: number;
  gameDuration: number; // in seconds
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameSettings {
  difficulty: Difficulty;
  language: 'fa' | 'en';
}
