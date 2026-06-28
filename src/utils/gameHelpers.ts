/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerType, UnitType, BuildingType, UnitState, Unit, Building, ResourceNode, Position } from '../types';

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getAngle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function createUnit(type: UnitType, player: PlayerType, x: number, y: number): Unit {
  const id = generateId();
  let hp = 100;
  let speed = 2.0;
  let range = 30;
  let damage = 10;
  let size = 10;
  let maxCarry = 0;
  let attackSpeed = 45; // lower is faster (ticks between attacks)

  switch (type) {
    case UnitType.WORKER:
      hp = 60;
      speed = 2.4;
      range = 25; // short distance for mining/repair
      damage = 4;
      size = 8;
      maxCarry = 15;
      attackSpeed = 50;
      break;
    case UnitType.SOLDIER:
      hp = 120;
      speed = 1.9;
      range = 140; // ranged rifle
      damage = 12;
      size = 10;
      attackSpeed = 35;
      break;
    case UnitType.HEAVY:
      hp = 300;
      speed = 1.2;
      range = 220; // long range cannon
      damage = 40;
      size = 14;
      attackSpeed = 75;
      break;
  }

  return {
    id,
    type,
    player,
    x,
    y,
    targetX: null,
    targetY: null,
    targetId: null,
    hp,
    maxHp: hp,
    state: UnitState.IDLE,
    speed,
    range,
    damage,
    attackCooldown: 0,
    attackSpeed,
    size,
    carryAmount: 0,
    maxCarry,
    angle: getAngle(x, y, x + (player === PlayerType.PLAYER ? 1 : -1), y - (player === PlayerType.PLAYER ? 1 : -1)),
    killCount: 0,
    cost: getUnitCost(type),
    buildTime: getUnitBuildTime(type)
  };
}

export function createBuilding(type: BuildingType, player: PlayerType, x: number, y: number, isComplete: boolean = false): Building {
  const id = generateId();
  let hp = 1000;
  let size = 40;
  let damage = 0;
  let attackRange = 0;
  let attackCooldown = 0;

  switch (type) {
    case BuildingType.COMMAND_CENTER:
      hp = 2500;
      size = 55;
      break;
    case BuildingType.BARRACKS:
      hp = 1200;
      size = 45;
      break;
    case BuildingType.TURRET:
      hp = 800;
      size = 30;
      damage = 18;
      attackRange = 180;
      attackCooldown = 30; // fast fire
      break;
    case BuildingType.HOUSE:
      hp = 600;
      size = 35;
      break;
    case BuildingType.WEAPONS_FACTORY:
      hp = 1000;
      size = 40;
      break;
    case BuildingType.AMMO_FACTORY:
      hp = 1000;
      size = 40;
      break;
    case BuildingType.TANK_FACTORY:
      hp = 1500;
      size = 50;
      break;
  }

  return {
    id,
    type,
    player,
    x,
    y,
    hp: isComplete ? hp : 10, // start low if building
    maxHp: hp,
    size,
    isComplete,
    buildProgress: isComplete ? 100 : 0,
    productionQueue: [],
    productionProgress: 0,
    cost: getBuildingCost(type),
    buildTime: getBuildingBuildTime(type),
    damage,
    attackRange,
    attackCooldown: 0
  };
}

export function getUnitCost(type: UnitType): { minerals: number } {
  switch (type) {
    case UnitType.WORKER: return { minerals: 50 };
    case UnitType.SOLDIER: return { minerals: 100 };
    case UnitType.HEAVY: return { minerals: 250 };
  }
}

export function getUnitBuildTime(type: UnitType): number {
  switch (type) {
    case UnitType.WORKER: return 300; // 5 seconds at 60fps
    case UnitType.SOLDIER: return 480; // 8 seconds
    case UnitType.HEAVY: return 900; // 15 seconds
  }
}

export function getBuildingCost(type: BuildingType): { minerals: number } {
  switch (type) {
    case BuildingType.COMMAND_CENTER: return { minerals: 400 };
    case BuildingType.BARRACKS: return { minerals: 150 };
    case BuildingType.TURRET: return { minerals: 125 };
    case BuildingType.HOUSE: return { minerals: 75 };
    case BuildingType.WEAPONS_FACTORY: return { minerals: 200 };
    case BuildingType.AMMO_FACTORY: return { minerals: 150 };
    case BuildingType.TANK_FACTORY: return { minerals: 300 };
  }
}

export function getBuildingBuildTime(type: BuildingType): number {
  switch (type) {
    case BuildingType.COMMAND_CENTER: return 1200; // 20 seconds
    case BuildingType.BARRACKS: return 600; // 10 seconds
    case BuildingType.TURRET: return 450; // 7.5 seconds
    case BuildingType.HOUSE: return 360; // 6 seconds
    case BuildingType.WEAPONS_FACTORY: return 700;
    case BuildingType.AMMO_FACTORY: return 600;
    case BuildingType.TANK_FACTORY: return 1000;
  }
}

export function findClosestResource(unit: Unit, resources: ResourceNode[]): ResourceNode | null {
  let closest: ResourceNode | null = null;
  let minDist = Infinity;

  for (const node of resources) {
    if (node.amount <= 0) continue;
    const d = distance(unit.x, unit.y, node.x, node.y);
    if (d < minDist) {
      minDist = d;
      closest = node;
    }
  }

  return closest;
}

export function findClosestCommandCenter(unit: Unit, buildings: Building[]): Building | null {
  let closest: Building | null = null;
  let minDist = Infinity;

  for (const b of buildings) {
    if (b.type === BuildingType.COMMAND_CENTER && b.player === unit.player && b.isComplete && b.hp > 0) {
      const d = distance(unit.x, unit.y, b.x, b.y);
      if (d < minDist) {
        minDist = d;
        closest = b;
      }
    }
  }

  return closest;
}

export function findClosestEnemy(
  source: { x: number; y: number; player: PlayerType; range: number },
  units: Unit[],
  buildings: Building[]
): { type: 'unit' | 'building'; target: any } | null {
  let closestTarget: { type: 'unit' | 'building'; target: any } | null = null;
  let minDist = Infinity;

  // Search units
  for (const u of units) {
    if (u.player !== source.player && u.player !== PlayerType.NEUTRAL && u.hp > 0) {
      const d = distance(source.x, source.y, u.x, u.y);
      if (d < minDist && d <= source.range) {
        minDist = d;
        closestTarget = { type: 'unit', target: u };
      }
    }
  }

  // Search buildings (only search if we haven't found a super close unit, or compare distances)
  for (const b of buildings) {
    if (b.player !== source.player && b.player !== PlayerType.NEUTRAL && b.hp > 0) {
      // For buildings, measure distance to edge of size
      const d = distance(source.x, source.y, b.x, b.y) - b.size / 2;
      if (d < minDist && d <= source.range) {
        minDist = d;
        closestTarget = { type: 'building', target: b };
      }
    }
  }

  return closestTarget;
}

export function handleSeparation(units: Unit[]) {
  // Simple O(N^2) pushing behavior to prevent overlaps. Fine for ~100 units.
  for (let i = 0; i < units.length; i++) {
    const u1 = units[i];
    if (u1.hp <= 0) continue;

    for (let j = i + 1; j < units.length; j++) {
      const u2 = units[j];
      if (u2.hp <= 0) continue;

      const dx = u2.x - u1.x;
      const dy = u2.y - u1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = u1.size + u2.size;

      if (dist < minDist && dist > 0.1) {
        const overlap = minDist - dist;
        // Calculate push vector
        const pushX = (dx / dist) * overlap * 0.25;
        const pushY = (dy / dist) * overlap * 0.25;

        // Apply push away from each other
        u1.x -= pushX;
        u1.y -= pushY;
        u2.x += pushX;
        u2.y += pushY;
      }
    }
  }
}
