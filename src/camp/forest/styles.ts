/**
 * 숲 화면 전용 키프레임.
 *
 * 노드 맵을 걷어내면서 절반이 죽었다 — nodeReveal·nodePulse·lineGrow 는 맵 전용이었고,
 * shimmerPass·treeSway·fogDrift·mist 는 정의만 있고 쓰는 데가 없었다. 남긴 것만 둔다.
 * 여기 있는 이름은 전부 실제로 쓰인다. 안 쓰게 되면 같이 지울 것.
 */
export const FOREST_STYLES = `
  /* palette-ok: file-level forest atmosphere */
  /* palette-ok: translucent game-scene overlays use the existing navy/gold visual language. */
  .forest-world { background:#0D1223; }
  .forest-player { width:clamp(84px,7.5vw,124px); transform:translate(-50%,-88%); transform-origin:50% 88%; transition:left 220ms linear,top 220ms linear; filter:drop-shadow(0 7px 4px rgba(13,18,35,.45)); }
  .forest-hit-area { appearance:none;border:0;background:transparent;cursor:pointer;touch-action:manipulation;outline:none; }
  .forest-path-marker { display:grid;place-items:center; }
  .forest-path-marker.is-selected .forest-event-icon { border-color:#E0C69B; box-shadow:0 0 0 3px rgba(13,18,35,.82),0 0 16px rgba(224,198,155,.55);transform:translateY(-2px); }
  .forest-event-icon { display:grid;place-items:center;width:52px;height:52px;border:2px solid #AC7B62;border-radius:50%;background:rgba(13,18,35,.94);font-size:25px;box-shadow:0 3px 12px rgba(13,18,35,.58);transition:.16s ease; }
  .forest-tooltip { position:absolute;top:calc(100% + 10px);left:50%;transform:translateX(-50%);min-width:190px;padding:9px 13px;border:1px solid #AC7B62;background:rgba(13,18,35,.95);color:#F3E5B9;text-align:center;white-space:nowrap;border-radius:6px;box-shadow:0 5px 15px rgba(13,18,35,.45); }
  .forest-tooltip strong,.forest-tooltip small { display:block;font-size:13px;line-height:1.55; }
  .forest-tooltip small { color:#CDB27E; }
  .forest-hud { position:absolute;z-index:30;border:1px solid rgba(172,123,98,.82);background:rgba(13,18,35,.9);color:#F3E5B9;border-radius:10px;padding:10px 18px;font-size:14px;letter-spacing:.04em;backdrop-filter:blur(5px);box-shadow:0 5px 16px rgba(13,18,35,.32); }
  .forest-title { top:26px;left:50%;transform:translateX(-50%);min-width:270px;text-align:center;font-size:16px; }
  .forest-stats { top:26px;right:28px;display:flex;flex-direction:column;gap:0;padding:0;overflow:hidden; }
  .forest-stats span { padding:9px 17px; }.forest-stats span+span{border-top:1px solid rgba(172,123,98,.55)}
  .forest-help { bottom:24px;left:28px;color:#CDB27E; }
  .forest-home { bottom:24px;left:50%;transform:translateX(-50%); }
  .forest-menu { bottom:24px;right:28px;color:#CDB27E; }
  .forest-fog { background:radial-gradient(ellipse at 50% 70%,transparent 20%,rgba(174,226,213,.55)),linear-gradient(100deg,transparent 20%,rgba(174,226,213,.35) 50%,transparent 78%);animation:forestFog 10s ease-in-out infinite alternate; }
  .forest-notice { position:absolute;z-index:40;left:50%;top:64%;transform:translate(-50%,-50%);padding:10px 16px;border:1px solid #CDB27E;background:rgba(13,18,35,.94);color:#F3E5B9;border-radius:8px; }
  .forest-transition { position:absolute;inset:0;z-index:50;background:#0D1223;animation:forestFade .36s ease both;pointer-events:none; }
  .forest-capture-layer { position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;background:rgba(13,18,35,.42);backdrop-filter:blur(3px); }
  .forest-capture-skip { padding:9px 16px;border:1px solid rgba(172,123,98,.75);border-radius:8px;background:rgba(13,18,35,.92);color:#CDB27E;font-size:13px; }
  @keyframes forestFog { from{transform:translateX(-2%)}to{transform:translateX(2%)} }
  @keyframes forestFade { 0%,100%{opacity:0}50%{opacity:1} }
  @media(max-width:700px){.forest-title{top:max(8px,env(safe-area-inset-top));min-width:210px}.forest-stats{top:58px;right:8px}.forest-help{display:none}.forest-menu{display:none}.forest-home{bottom:max(8px,env(safe-area-inset-bottom));white-space:nowrap}.forest-player{width:82px}.forest-tooltip{min-width:150px}.forest-event-icon{width:44px;height:44px;font-size:21px}}
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
