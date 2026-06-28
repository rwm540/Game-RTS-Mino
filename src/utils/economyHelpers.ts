/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResourceType } from '../types';

export interface StateCurrency {
  factionId: string;
  factionName: string;
  currencyName: string;
  currencySymbol: string;
  backingResource: ResourceType;
  backingAmount: number; // reserves in vault
  circulatingSupply: number; // minted circulating cash
  exchangeRate: number; // value relative to Pars Rial (1 Pars Rial = 1.0 base)
  accountBalance: number; // local state treasury
}

export const INITIAL_CURRENCIES: { [key: string]: StateCurrency } = {
  player: {
    factionId: 'player',
    factionName: 'جمهوری پارس',
    currencyName: 'ریال پارس (Rials)',
    currencySymbol: '﷼',
    backingResource: ResourceType.GOLD,
    backingAmount: 1000,
    circulatingSupply: 10000,
    exchangeRate: 1.0,
    accountBalance: 2500,
  },
  enemy: {
    factionId: 'enemy',
    factionName: 'لشکر سیاه اهریمن',
    currencyName: 'دراخمای تاریک (Tenebris)',
    currencySymbol: '☠',
    backingResource: ResourceType.COAL,
    backingAmount: 1500,
    circulatingSupply: 25000,
    exchangeRate: 0.35,
    accountBalance: 12000,
  },
  f1: {
    factionId: 'f1',
    factionName: 'قلعه بابک (آذربایجان)',
    currencyName: 'دینار آذری (AZD)',
    currencySymbol: '₼',
    backingResource: ResourceType.IRON,
    backingAmount: 800,
    circulatingSupply: 4000,
    exchangeRate: 1.6,
    accountBalance: 3000,
  },
  f2: {
    factionId: 'f2',
    factionName: 'قلعه توس (خراسان)',
    currencyName: 'ریال توس (KHR)',
    currencySymbol: '₮',
    backingResource: ResourceType.STONE,
    backingAmount: 1200,
    circulatingSupply: 8000,
    exchangeRate: 0.9,
    accountBalance: 4000,
  },
  f3: {
    factionId: 'f3',
    factionName: 'قلعه اصفهان (سپاهان)',
    currencyName: 'درهم سپاهان (SPD)',
    currencySymbol: '₯',
    backingResource: ResourceType.GOLD,
    backingAmount: 600,
    circulatingSupply: 3000,
    exchangeRate: 2.1,
    accountBalance: 1500,
  },
  f4: {
    factionId: 'f4',
    factionName: 'قلعه بیشاپور (فارس)',
    currencyName: 'دراخمای ساسانی (SAD)',
    currencySymbol: '₰',
    backingResource: ResourceType.WOOD,
    backingAmount: 1400,
    circulatingSupply: 7000,
    exchangeRate: 1.1,
    accountBalance: 5000,
  },
  f5: {
    factionId: 'f5',
    factionName: 'قلعه هگمتانه (ماد)',
    currencyName: 'شکل مادی (MDS)',
    currencySymbol: '₪',
    backingResource: ResourceType.STONE,
    backingAmount: 1100,
    circulatingSupply: 5500,
    exchangeRate: 1.3,
    accountBalance: 2800,
  },
  f6: {
    factionId: 'f6',
    factionName: 'قلعه ری (کاسپین)',
    currencyName: 'تاج طبری (TBC)',
    currencySymbol: '👑',
    backingResource: ResourceType.WOOD,
    backingAmount: 1600,
    circulatingSupply: 9000,
    exchangeRate: 0.85,
    accountBalance: 6000,
  },
  f7: {
    factionId: 'f7',
    factionName: 'قلعه شوش (خوزستان)',
    currencyName: 'تالنت عیلامی (ELT)',
    currencySymbol: '𓍝',
    backingResource: ResourceType.OIL,
    backingAmount: 400,
    circulatingSupply: 2000,
    exchangeRate: 3.2,
    accountBalance: 1000,
  },
  f8: {
    factionId: 'f8',
    factionName: 'قلعه زابل (نیمروز)',
    currencyName: 'دراخمای زابل (SDR)',
    currencySymbol: '🏹',
    backingResource: ResourceType.GOLD,
    backingAmount: 900,
    circulatingSupply: 4500,
    exchangeRate: 1.8,
    accountBalance: 2200,
  }
};

// Base weight of backing assets
export const ASSET_BASE_INDEX: { [key in ResourceType]: number } = {
  GOLD: 20.0,
  OIL: 16.0,
  IRON: 10.0,
  COAL: 6.0,
  STONE: 4.0,
  WOOD: 3.0
};

/**
 * Dynamically computes a faction's currency exchange rate relative to the Pars Rial base.
 * @param curr The current StateCurrency specs
 */
export function calculateRate(curr: StateCurrency): number {
  const baseValue = ASSET_BASE_INDEX[curr.backingResource] || 5.0;
  // Valuation is based on: Backing Reserves * Base Value divided by Circulating Supply
  // Scaled so Pars Rial begins at 1.0
  const numerator = curr.backingAmount * baseValue;
  const denominator = curr.circulatingSupply + 100;
  
  const rawRate = (numerator / denominator) * 10;
  // Clamp between 0.05 and 50.0 for gameplay stability
  return Math.round(Math.max(0.05, Math.min(50.0, rawRate)) * 100) / 100;
}

/**
 * Commodity pricing in standard Gold index.
 * Base prices dynamically shift based on globally available supply / market demands.
 */
export function getCommodityPrice(resource: ResourceType, totalInventory: number): { buyPrice: number; sellPrice: number } {
  const basePrice = ASSET_BASE_INDEX[resource] || 5.0;
  
  // High global inventories lower price, low inventories raise price
  // Let's model a friendly supply-demand curve
  const inventoryFactor = Math.max(0.2, Math.min(3.0, 500 / (totalInventory + 50)));
  const currentBasePrice = basePrice * inventoryFactor;
  
  const buyPrice = Math.round(currentBasePrice * 1.15 * 100) / 100; // 15% spread/broker fee
  const sellPrice = Math.round(currentBasePrice * 0.85 * 100) / 100;
  
  return {
    buyPrice: Math.max(1, buyPrice),
    sellPrice: Math.max(0.5, sellPrice)
  };
}
