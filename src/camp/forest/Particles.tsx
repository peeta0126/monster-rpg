import { useState } from "react";
import { rgba } from "../../shared/palette";
import type { ForestArea } from "./areas";

/**
 * 구역 분위기용 파티클. 배경 자체는 ForestBackdrop 의 원화가 그린다 —
 * 여기 있는 건 그 위에 얹는 움직임뿐이다.
 */

/**
 * 밀도 배수를 개수로 바꾼다. 배수가 바뀌면 배열이 다시 만들어져 위치도 다시 뽑히므로,
 * 최대 개수를 한 번만 만들어 두고 앞에서부터 잘라 쓴다 — 소란도가 오를 때 화면이
 * 통째로 새로 뿌려지지 않고 입자만 늘어난다.
 */
const MAX_DENSITY = 2;
function visibleCount(base: number, density: number) {
  return Math.round(base * Math.min(density, MAX_DENSITY));
}

function LeafParticles({ density }: { density: number }) {
  const [leaves] = useState(()=>Array.from({length:18 * MAX_DENSITY},(_,i)=>({
    id:i,
    x: Math.random()*100,
    delay: Math.random()*10,
    dur: 7+Math.random()*7,
    size: 5+Math.random()*7,
    // 두 톤을 섞어 흔든다. 한 색으로 통일하면 스티커 붙인 것처럼 보인다.
    color: rgba(Math.random()>.5 ? "moss500" : "moss700", .5+Math.random()*.4),
    flip: Math.random()>.5,
  })));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {leaves.slice(0, visibleCount(18, density)).map(l=>(
        <div key={l.id} className="absolute" style={{
          left:`${l.x}%`, top:"-3%",
          width:l.size, height:l.size*.55,
          background:l.color,
          borderRadius:"50% 0 50% 0",
          animation:`${l.flip?"leafFallR":"leafFall"} ${l.dur}s linear ${l.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function FireflyParticles({ density }: { density: number }) {
  const [flies] = useState(()=>Array.from({length:22 * MAX_DENSITY},(_,i)=>({
    id:i,
    x:Math.random()*100,
    y:20+Math.random()*65,
    delay:Math.random()*8,
    dur:4+Math.random()*5,
    size:2.5+Math.random()*2,
    hue:Math.random()>.5?"174, 226, 213":"205, 178, 126", // palette-ok: mist-300 / sand-300 의 rgb
  })));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {flies.slice(0, visibleCount(22, density)).map(f=>(
        <div key={f.id} className="absolute rounded-full" style={{
          left:`${f.x}%`, top:`${f.y}%`,
          width:f.size, height:f.size,
          background:`rgba(${f.hue},1)`,
          boxShadow:`0 0 ${f.size*3}px ${f.size}px rgba(${f.hue},.6)`,
          animation:`fireflyFloat ${f.dur}s ease-in-out ${f.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function CrystalParticles({ density }: { density: number }) {
  const [crystals] = useState(()=>Array.from({length:16 * MAX_DENSITY},(_,i)=>({
    id:i,
    x:5+Math.random()*90,
    y:10+Math.random()*80,
    delay:Math.random()*8,
    dur:3+Math.random()*5,
    size:3+Math.random()*4,
    hue:Math.random()>.5?"233, 148, 65":"224, 198, 155", // palette-ok: ember-500 / sand-200 의 rgb
  })));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {crystals.slice(0, visibleCount(16, density)).map(c=>(
        <div key={c.id} className="absolute" style={{
          left:`${c.x}%`, bottom:`${c.y}%`,
          width:c.size, height:c.size*1.5,
          clipPath:"polygon(50% 0%,100% 60%,50% 100%,0% 60%)",
          background:`rgba(${c.hue},.9)`,
          filter:`blur(.5px) drop-shadow(0 0 3px rgba(${c.hue},.8))`,
          animation:`crystalDrift ${c.dur}s ease-in ${c.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

/** density: 소란도 구간이 주는 밀도 배수. 1 이 기본이고 소란이 오를수록 입자가 늘어난다 */
export function Particles({ area, density = 1 }: { area: ForestArea; density?: number }) {
  if (area.particleType==="leaf")    return <LeafParticles density={density}/>;
  if (area.particleType==="firefly") return <FireflyParticles density={density}/>;
  return <CrystalParticles density={density}/>;
}
