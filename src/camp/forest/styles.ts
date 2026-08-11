/**
 * 숲 화면 전용 키프레임.
 *
 * 노드 맵을 걷어내면서 절반이 죽었다 — nodeReveal·nodePulse·lineGrow 는 맵 전용이었고,
 * shimmerPass·treeSway·fogDrift·mist 는 정의만 있고 쓰는 데가 없었다. 남긴 것만 둔다.
 * 여기 있는 이름은 전부 실제로 쓰인다. 안 쓰게 되면 같이 지울 것.
 */
export const FOREST_STYLES = `
@keyframes leafFall {
  0%   { transform: translateY(-6vh) translateX(0px) rotate(0deg); opacity:0; }
  8%   { opacity:.85; }
  90%  { opacity:.5; }
  100% { transform: translateY(108vh) translateX(40px) rotate(540deg); opacity:0; }
}
@keyframes leafFallR {
  0%   { transform: translateY(-6vh) translateX(0px) rotate(0deg); opacity:0; }
  8%   { opacity:.7; }
  100% { transform: translateY(108vh) translateX(-30px) rotate(-360deg); opacity:0; }
}
@keyframes fireflyFloat {
  0%,100%{ transform:translate(0,0) scale(1); opacity:.2; }
  20%   { transform:translate(22px,-18px) scale(1.3); opacity:.95; }
  40%   { transform:translate(-8px,-30px) scale(.8); opacity:.75; }
  70%   { transform:translate(-20px,-8px) scale(1.1); opacity:.5; }
}
@keyframes crystalDrift {
  0%   { transform: translateY(0) rotate(0deg) scale(1); opacity:.1; }
  30%  { opacity:.8; }
  70%  { opacity:.4; }
  100% { transform: translateY(-70px) rotate(200deg) scale(.5); opacity:0; }
}
@keyframes monsterFloat {
  0%,100%{ transform:translateY(0px); }
  50%   { transform:translateY(-14px); }
}
@keyframes slideInUp {
  from{ transform:translateY(36px); opacity:0; }
  to  { transform:translateY(0);    opacity:1; }
}
@keyframes fadeInScale {
  from{ transform:scale(.88); opacity:0; }
  to  { transform:scale(1);   opacity:1; }
}
@keyframes itemDrop {
  0%  { transform:translateY(-20px) scale(.7); opacity:0; }
  60% { transform:translateY(4px) scale(1.08); opacity:1; }
  100%{ transform:translateY(0) scale(1); opacity:1; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
