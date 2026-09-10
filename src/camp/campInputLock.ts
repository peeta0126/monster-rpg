/**
 * 캔버스가 키를 먹어도 되는가.
 *
 * 상호작용 키를 X 하나로 모으면서 필요해졌다. 예전에는 걷기·상호작용이 E, 대사 넘기기가
 * Space 라 서로 안 겹쳤는데, 둘 다 X 가 되면서 대사를 넘기려고 누른 X 가 같은 프레임에
 * 씬의 상호작용까지 깨워 그 대사를 처음부터 다시 열었다.
 *
 * React 는 무엇이 떠 있는지 알고 씬은 모른다. 그래서 아는 쪽이 적어 두고 모르는 쪽이
 * 읽는다. 이벤트로 넘기지 않는 건 씬이 키를 처리하는 그 순간의 값이 필요해서다 —
 * 이벤트는 한 프레임 늦게 도착할 수 있고, 그 한 프레임이 정확히 이 사고다.
 *
 * ⚠ 화면을 떠날 때 반드시 푼다. 잠근 채로 나가면 다시 들어왔을 때 아무 키도 안 먹는다.
 */
let _locked = false;

export function setCampInputLocked(locked: boolean): void {
  _locked = locked;
}

export function isCampInputLocked(): boolean {
  return _locked;
}
