/**
 * "막 시작한 사람"의 세이브.
 *
 * 예전에는 `monster-rpg-player` 를 지우기만 하면 됐다. 새 세이브가 플레미를
 * 파티에 넣어 줬기 때문이다. 지금은 첫 몬스터를 이장 오리온이 준다(campDialogues).
 * 그래서 세이브를 지우면 파티가 비고, /battle 은 베이스캠프로 되돌려진다.
 *
 * 전투 화면을 찍는 스펙은 "이장에게 막 받은 직후"를 심어야 한다. 그 상태가 이것이다.
 */
export const FRESH_SAVE = JSON.stringify({
  state: {
    party: [{ id: "flameling", level: 1, uid: "fresh-0" }],
    storage: [], dexSeen: ["flameling"], dexCaught: ["flameling"],
    materials: {}, potions: {}, bestFloor: 0,
    storyFlags: { met_orion: true }, questStatus: {},
    // 이장의 첫 대화는 이미 들은 상태다. 그래서 플레미가 파티에 있다. 이걸 안 적으면
    // 다음에 이장에게 말을 걸 때 그 대사가 처음부터 다시 나온다.
    seenDialogues: ["orion_intro"],
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
    imprint: {},
  },
  version: 2,
});
