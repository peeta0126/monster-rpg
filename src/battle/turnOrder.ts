import { turnsToExtraAction, type BattleMonster } from "./battleUtils";

/**
 * 이번 라운드의 행동 순서 계산. 컴포넌트와 떼어 둔 건 테스트에서 부르기 위해서다 —
 * 화면이 적는 순서가 전투 루프의 순서와 같은지는 눈이 아니라 테스트가 봐야 한다.
 */

interface Slot {
  side: "player" | "enemy";
  name: string;
  /** 속도 게이지로 얻은 추가 행동인가 */
  extra: boolean;
}

/** 이번 라운드에 실제로 벌어질 순서. 전투 루프(handleMoveClick)와 같은 규칙이어야 한다 */
export function buildTurnOrder(
  player: BattleMonster, enemy: BattleMonster,
  playerSpeed: number, playerCharge: number, enemyCharge: number,
): Slot[] {
  const playerFirst = playerSpeed >= enemy.speed;
  const slots: Slot[] = playerFirst
    ? [{ side: "player", name: player.name, extra: false }, { side: "enemy", name: enemy.name, extra: false }]
    : [{ side: "enemy", name: enemy.name, extra: false }, { side: "player", name: player.name, extra: false }];

  // 이번 턴에 게이지가 차는 쪽이 있으면 맨 뒤에 한 번 더 선다
  const pNext = turnsToExtraAction(playerCharge, playerSpeed, enemy.speed);
  const eNext = turnsToExtraAction(enemyCharge, enemy.speed, playerSpeed);
  if (pNext === 1) slots.push({ side: "player", name: player.name, extra: true });
  else if (eNext === 1) slots.push({ side: "enemy", name: enemy.name, extra: true });

  return slots;
}

