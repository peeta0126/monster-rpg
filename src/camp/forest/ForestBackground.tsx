import { useState } from "react";
import { PALETTE, rgba } from "../../shared/palette";
import { BASECAMP_BACKGROUND_IMAGE } from "../../shared/assetPaths";
import type { ForestArea } from "./areas";

// ═══════════════════════════════════════════════════════════════════════════════
// 파티클 컴포넌트
// ═══════════════════════════════════════════════════════════════════════════════

function LeafParticles() {
  const [leaves] = useState(()=>Array.from({length:18},(_,i)=>({
    id:i,
    x: Math.random()*100,
    delay: Math.random()*10,
    dur: 7+Math.random()*7,
    size: 5+Math.random()*7,
    color: `rgba(${30+Math.floor(Math.random()*40)},${150+Math.floor(Math.random()*70)},${40+Math.floor(Math.random()*40)},${.5+Math.random()*.4})`,
    flip: Math.random()>.5,
  })));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {leaves.map(l=>(
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

function FireflyParticles() {
  const [flies] = useState(()=>Array.from({length:22},(_,i)=>({
    id:i,
    x:Math.random()*100,
    y:20+Math.random()*65,
    delay:Math.random()*8,
    dur:4+Math.random()*5,
    size:2.5+Math.random()*2,
    hue:Math.random()>.5?"170,255,160":"220,255,120",
  })));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {flies.map(f=>(
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

function CrystalParticles() {
  const [crystals] = useState(()=>Array.from({length:16},(_,i)=>({
    id:i,
    x:5+Math.random()*90,
    y:10+Math.random()*80,
    delay:Math.random()*8,
    dur:3+Math.random()*5,
    size:3+Math.random()*4,
    hue:Math.random()>.5?"167,139,250":"196,181,253",
  })));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {crystals.map(c=>(
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

export function Particles({ area }: { area: ForestArea }) {
  if (area.particleType==="leaf")    return <LeafParticles/>;
  if (area.particleType==="firefly") return <FireflyParticles/>;
  return <CrystalParticles/>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 배경
// ═══════════════════════════════════════════════════════════════════════════════

/** 고대숲 배경의 별. 렌더마다 뽑으면 상태가 바뀔 때마다 별 60개가 통째로 튀므로 한 번만 생성한다. */
function AncientStars() {
  const [stars] = useState(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 60,
        size: 1 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.6,
        dur: 3 + Math.random() * 4,
        delay: Math.random() * 6,
      })),
  );

  return (
    <div className="absolute inset-0">
      {stars.map((s) => (
        <div key={s.id} className="absolute rounded-full bg-cream-100"
          style={{
            left:`${s.left}%`, top:`${s.top}%`,
            width:s.size, height:s.size,
            opacity:s.opacity,
            animation:`crystalDrift ${s.dur}s ease-in-out ${s.delay}s infinite alternate`,
          }}/>
      ))}
    </div>
  );
}

export function ForestBackground({ area }: { area: ForestArea | null }) {
  // 구역 선택 화면에서는 area가 null이다. 이때 중립 회청색으로 두면 숲으로 안 보여서
  // 얕은 숲 테마를 기본값으로 쓴다.
  const a = area;
  const sky1 = a?.skyTop    ?? PALETTE.moss700;
  const sky2 = a?.skyBottom ?? PALETTE.shadow800;
  const fog  = a?.fogColor  ?? rgba("moss500", 0.14);
  const gnd  = a?.groundColor ?? PALETTE.moss700;
  const ancient = a?.id==="ancient";
  const deep    = a?.id==="deep";

  // 나무 실루엣 2겹. 구역마다 원경 색을 바꿔 "다른 숲에 왔다"가 읽히게 하고,
  // 근경은 항상 가장 어두운 색으로 고정해 깊이를 만든다.
  const farTree  = ancient ? PALETTE.stone600 : deep ? PALETTE.shadow700 : PALETTE.moss700;
  const nearTree = PALETTE.shadow900;
  // 빛줄기 색 — 얕은 숲은 잎 사이로 드는 햇빛, 깊은 숲은 차가운 빛, 고대 숲은 잔불
  const rayColor = ancient ? "233, 148, 65" : deep ? "174, 226, 213" : "205, 178, 126";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{
        background:`radial-gradient(ellipse at 50% 0%, ${sky1} 0%, ${sky2} 60%, ${PALETTE.shadow900} 100%)`,
      }}/>
      {ancient && <AncientStars />}

      {/* 중경 — 베이스캠프 배경을 흐리게 깔아 밋밋한 그라디언트에 질감을 준다.
          아래로 갈수록 사라지게 마스크를 걸어 나무 실루엣과 자연스럽게 이어붙인다. */}
      <img
        src={BASECAMP_BACKGROUND_IMAGE}
        alt=""
        className="absolute inset-x-0 top-0 h-3/5 w-full object-cover opacity-20"
        style={{
          filter: "blur(14px) brightness(0.4) saturate(0.6)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)",
        }}
      />

      <svg className="absolute bottom-32 left-0 w-full" viewBox="0 0 960 240" preserveAspectRatio="xMidYMax meet">
        {[[30,240,60,90],[85,240,45,120],[145,240,58,105],[210,240,50,130],[275,240,65,95],
          [345,240,42,125],[405,240,56,110],[465,240,52,118],[525,240,64,98],[595,240,46,122],
          [655,240,59,108],[715,240,52,114],[775,240,65,94],[835,240,44,126],[895,240,59,105],[950,240,52,112]]
          .map(([cx,by,hw,h],i)=>(
            <polygon key={i} points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
              fill={farTree}
              opacity={.7+Math.sin(i)*.1}/>
          ))}
      </svg>
      <svg className="absolute bottom-24 left-0 w-full" viewBox="0 0 960 320" preserveAspectRatio="xMidYMax meet">
        {[[-20,320,82,180],[75,320,70,200],[180,320,88,170],[300,320,74,190],[410,320,90,185],
          [520,320,66,205],[630,320,84,178],[740,320,76,195],[850,320,86,182],[960,320,72,198]]
          .map(([cx,by,hw,h],i)=>(
            <g key={i} style={{ animation:`treeSway ${3+i*.3}s ease-in-out ${i*.4}s infinite alternate` }}>
              <polygon points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
                fill={nearTree} opacity=".95"/>
              <polygon points={`${cx-hw*.3},${by} ${cx-hw*.08},${by-h*.65} ${cx},${by-h}`}
                fill={ancient?"rgba(168, 61, 31, .06)":deep?"rgba(92, 147, 150, .07)":"rgba(122, 132, 85, .07)"}/>
            </g>
          ))}
      </svg>
      {/* 빛줄기. 과하면 싸구려 티가 나므로 최대 opacity 0.12 */}
      {[18, 42, 68].map((leftPct, i) => (
        <div key={leftPct} className="pointer-events-none absolute top-0 origin-top"
          style={{
            left: `${leftPct}%`,
            width: 90 + i * 40,
            height: "78%",
            transform: `rotate(${8 + i * 3}deg)`,
            background: `linear-gradient(to bottom, rgba(${rayColor}, ${0.1 - i * 0.02}) 0%, transparent 85%)`,
            filter: "blur(10px)",
          }}/>
      ))}

      <div className="absolute inset-x-0 bottom-24 h-40 pointer-events-none"
        style={{
          background:`linear-gradient(to top, ${gnd}cc 0%, ${fog} 60%, transparent 100%)`,
          animation:"fogDrift 8s ease-in-out infinite",
        }}/>
      <div className="absolute bottom-0 left-0 right-0 h-28"
        style={{ background:`linear-gradient(to top, ${gnd} 0%, ${gnd}cc 60%, transparent 100%)` }}/>
      <svg className="absolute bottom-24 left-0 w-full" viewBox="0 0 960 60" preserveAspectRatio="xMidYMax meet">
        {Array.from({length:32}).map((_,i)=>{
          const x=(i*31)+Math.sin(i*1.9)*9;
          const h=14+Math.sin(i*2.5)*9;
          const col = ancient?"rgba(168, 61, 31, .6)":deep?"rgba(92, 147, 150, .7)":"rgba(122, 132, 85, .8)";
          return (
            <g key={i}>
              <polygon points={`${x},60 ${x-5},${60-h} ${x+4},60`} fill={col}/>
              <polygon points={`${x+9},60 ${x+3},${60-h*.8} ${x+14},60`} fill={col} opacity=".7"/>
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: ancient
            ? "radial-gradient(ellipse 50% 25% at 50% 5%, rgba(168, 61, 31, .08) 0%, transparent 80%)"
            : deep
              ? "radial-gradient(ellipse 50% 20% at 50% 5%, rgba(92, 147, 150, .06) 0%, transparent 80%)"
              : "radial-gradient(ellipse 55% 22% at 50% 5%, rgba(122, 132, 85, .07) 0%, transparent 80%)",
        }}/>
      {[45,60,72].map((pct,i)=>(
        <div key={i} className="absolute inset-x-0 pointer-events-none h-8"
          style={{
            bottom:`${pct}%`,
            background:`linear-gradient(to right, transparent 0%, ${fog} 30%, ${fog} 70%, transparent 100%)`,
            opacity:.6,
            animation:`mist ${6+i*2}s ease-in-out ${i*1.5}s infinite`,
          }}/>
      ))}

      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(13,18,35,0.78) 100%)" }}/>
    </div>
  );
}
