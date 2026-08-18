import { ORION_DIALOGUES, BAROS_DIALOGUES, satisfiedEntries } from "./campDialogues";
import type { PersistedStoryFlag } from "../shared/storyFlags";

/**
 * "본 대사 기록"이 없던 세이브에 그 기록을 채워 넣는다.
 *
 * 기록이 생기기 전에는 대사 선택이 "조건을 만족하는 것 중 마지막"이었다. 그래서 옛
 * 세이브를 그냥 빈 기록으로 열면, 지금까지 지나온 대사가 처음부터 다시 전부 재생된다 —
 * 엔딩까지 본 사람이 첫 만남 대사부터 다시 듣는다.
 *
 * 그래서 **조건을 만족하는 대사는 전부 봤다고 찍되, 사람마다 마지막 하나는 남긴다.**
 * 그 마지막 하나가 곧 지금 코드가 다음 대화에서 보여줄 바로 그 대사라, 옛 세이브의
 * 다음 한 번은 예전과 똑같이 흐르고 그 뒤부터 잡담으로 넘어간다. 이어붙인 티가 안 난다.
 *
 * ⚠️ 부르는 쪽 조건 — 기록이 **아예 없을 때(undefined)만** 부를 것. 빈 배열은 "새로
 * 시작해서 아직 아무것도 안 봤다"는 뜻이라 손대면 안 된다. 세이브 정규화는 저장할
 * 때마다도 돌기 때문에, 그 구분을 놓치면 새 플레이어가 매 저장마다 전 대사를 본 것으로
 * 찍힌다.
 */
export function backfillSeenDialogues(
  storyFlags: Record<PersistedStoryFlag, boolean>,
  bestFloor: number,
): string[] {
  const seen: string[] = [];
  for (const list of [ORION_DIALOGUES, BAROS_DIALOGUES]) {
    const reachable = satisfiedEntries(list, storyFlags, bestFloor);
    // 마지막 하나는 남긴다 — 그게 예전 로직이 다음에 보여줄 대사다
    for (const entry of reachable.slice(0, -1)) seen.push(entry.id);
  }
  return seen;
}
