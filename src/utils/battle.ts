import { typeChart } from "../data/typeChart";
import type { Monster, Move } from "../types/game";

export interface BattleMonster extends Monster {
  currentHp: number;
}

export function createBattleMonster(monster: Monster): BattleMonster {
  return {
    ...monster,
    currentHp: monster.maxHp,
  };
}

export function getTypeMultiplier(
  moveType: Move["type"],
  targetType: Monster["type"]
) {
  return typeChart[moveType]?.[targetType] ?? 1;
}

export function calculateDamage(
  attacker: BattleMonster,
  defender: BattleMonster,
  move: Move
) {
  const multiplier = getTypeMultiplier(move.type, defender.type);

  const hitRoll = Math.random() * 100;
  const isHit = hitRoll <= move.accuracy;

  if (!isHit) {
    return {
      damage: 0,
      isHit: false,
      multiplier,
    };
  }

  const levelBonus = attacker.level * 2;

  const baseDamage = Math.max(
    1,
    Math.floor(attacker.attack + move.power + levelBonus - defender.defense / 2)
  );

  const damage = Math.max(1, Math.floor(baseDamage * multiplier));

  return {
    damage,
    isHit: true,
    multiplier,
  };
}

export function applyDamage(target: BattleMonster, damage: number): BattleMonster {
  return {
    ...target,
    currentHp: Math.max(0, target.currentHp - damage),
  };
}

export function isFainted(monster: BattleMonster) {
  return monster.currentHp <= 0;
}

export function gainExp(monster: BattleMonster, gainedExp: number) {
  let nextMonster: BattleMonster = {
    ...monster,
    exp: monster.exp + gainedExp,
  };

  let leveledUp = false;

  while (nextMonster.exp >= nextMonster.expToNextLevel) {
    nextMonster = {
      ...nextMonster,
      exp: nextMonster.exp - nextMonster.expToNextLevel,
      level: nextMonster.level + 1,
      expToNextLevel: Math.floor(nextMonster.expToNextLevel * 1.2),
      maxHp: nextMonster.maxHp + 10,
      attack: nextMonster.attack + 3,
      defense: nextMonster.defense + 2,
      speed: nextMonster.speed + 2,
    };

    nextMonster.currentHp = nextMonster.maxHp;
    leveledUp = true;
  }

  return {
    updatedMonster: nextMonster,
    leveledUp,
  };
}