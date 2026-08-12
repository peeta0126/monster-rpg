/**
 * 숲 화면 전용 키프레임.
 *
 * 노드 맵을 걷어내면서 절반이 죽었다 — nodeReveal·nodePulse·lineGrow 는 맵 전용이었고,
 * shimmerPass·treeSway·fogDrift·mist 는 정의만 있고 쓰는 데가 없었다. 남긴 것만 둔다.
 * 여기 있는 이름은 전부 실제로 쓰인다. 안 쓰게 되면 같이 지울 것.
 */
export const FOREST_STYLES = `
  /* palette-ok: translucent game-scene overlays use the existing navy/gold visual language */
  .forest-world { background:#07111f; }
  .forest-player { width:clamp(72px,10vw,160px); transition:left 220ms linear,top 220ms linear; filter:drop-shadow(0 8px 5px rgba(0,0,0,.45)); }
  .forest-path { width:max(64px,9vw); height:max(64px,9vw); display:grid; place-items:center; border:2px solid transparent; touch-action:manipulation; }
  .forest-path.is-selected { border-color:#d9b875; background:rgba(7,17,31,.2); box-shadow:0 0 18px rgba(217,184,117,.6); }
  .forest-event-icon { display:grid;place-items:center;width:42px;height:42px;border:1px solid #d9b875;border-radius:50%;background:rgba(7,17,31,.9);font-size:22px;box-shadow:0 3px 12px rgba(0,0,0,.6); }
  .forest-tooltip { position:absolute;bottom:calc(100% + 5px);left:50%;transform:translateX(-50%);min-width:145px;padding:7px 9px;border:1px solid #d9b875;background:rgba(7,17,31,.96);color:#fff4d6;text-align:left;white-space:nowrap;border-radius:7px; }
  .forest-tooltip strong,.forest-tooltip small { display:block;font-size:11px;line-height:1.5; }
  .forest-tooltip small { color:#d8c59f; }
  .forest-hud { position:absolute;z-index:30;border:1px solid rgba(217,184,117,.65);background:rgba(7,17,31,.84);color:#fff4d6;border-radius:8px;padding:7px 11px;font-size:12px;backdrop-filter:blur(4px); }
  .forest-title { top:14px;left:50%;transform:translateX(-50%); }
  .forest-stats { top:14px;right:14px;display:flex;gap:13px; }
  .forest-help { bottom:14px;left:14px;color:#d8c59f; }
  .forest-home { bottom:14px;left:50%;transform:translateX(-50%); }
  .forest-menu { bottom:14px;right:14px;color:#d8c59f; }
  .forest-fog { background:radial-gradient(ellipse at 50% 70%,transparent 20%,rgba(175,215,215,.55)),linear-gradient(100deg,transparent 20%,rgba(190,220,220,.35) 50%,transparent 78%);animation:forestFog 10s ease-in-out infinite alternate; }
  .forest-notice { position:absolute;z-index:40;left:50%;top:64%;transform:translate(-50%,-50%);padding:10px 16px;border:1px solid #d9b875;background:rgba(7,17,31,.94);color:#fff4d6;border-radius:8px; }
  .forest-transition { position:absolute;inset:0;z-index:50;background:#07111f;animation:forestFade .36s ease both;pointer-events:none; }
  @keyframes forestFog { from{transform:translateX(-2%)}to{transform:translateX(2%)} }
  @keyframes forestFade { 0%,100%{opacity:0}50%{opacity:1} }
  @media(max-width:700px){.forest-stats{top:54px;right:8px}.forest-help{display:none}.forest-menu{display:none}.forest-home{bottom:8px}.forest-player{width:88px}.forest-tooltip{min-width:125px}}
  @media(prefers-reduced-motion:reduce){.forest-player{transition:none}.forest-fog{animation:none}.forest-transition{animation:none;opacity:.35}}
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
