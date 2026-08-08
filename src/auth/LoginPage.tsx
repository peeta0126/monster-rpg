import { useEffect, useMemo, useRef } from "react";
import "./LoginPage.css";
import {
  LOGIN_BACKGROUND_IMAGE,
  LOGIN_BACKGROUND_IMAGE_WEBP,
  LOGIN_BACKGROUND_ASPECT_RATIO,
} from "../shared/assetPaths";
import { generateParticles } from "./particles";
import LoginForm from "./LoginForm";

const MAX_PARALLAX_PX = 14;

export default function LoginPage() {
  const bgImgRef = useRef<HTMLImageElement>(null);
  const particles = useMemo(() => generateParticles(), []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    function onMouseMove(e: MouseEvent) {
      const img = bgImgRef.current;
      if (!img) return;
      const nx = e.clientX / window.innerWidth - 0.5;  // -0.5 ~ 0.5
      const ny = e.clientY / window.innerHeight - 0.5;
      // 마우스 반대 방향으로 이동
      img.style.transform = `translate(${-nx * 2 * MAX_PARALLAX_PX}px, ${-ny * 2 * MAX_PARALLAX_PX}px)`;
    }

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] bg-shadow-900">
      <div
        className="login-stage"
        style={{
          width: `min(100vw, calc(100vh * ${LOGIN_BACKGROUND_ASPECT_RATIO}))`,
          height: `min(100vh, calc(100vw / ${LOGIN_BACKGROUND_ASPECT_RATIO}))`,
        }}
      >
        <div className="login-kenburns">
          <picture>
            <source srcSet={LOGIN_BACKGROUND_IMAGE_WEBP} type="image/webp" />
            <img
              ref={bgImgRef}
              src={LOGIN_BACKGROUND_IMAGE}
              alt=""
              className="login-bg-img"
              draggable={false}
              onError={(e) => {
                // 이미지 로드 실패 시에도 화면이 깨지지 않도록 폴백 배경색만 남긴다
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </picture>
        </div>

        <div className="login-particle-field">
          {particles.map((p) => (
            <span
              key={p.id}
              className={`login-particle ${p.colorClass}`}
              style={{
                left: `${p.leftPct}%`,
                width: p.sizePx,
                height: p.sizePx,
                animationDuration: `${p.durationS}s`,
                animationDelay: `${p.delayS}s`,
              }}
            />
          ))}
        </div>

        <div className="login-vignette" />

        {/* 로고 아래 · 여행자 위 빈 공간(가로 8~38%, 세로 40~66%)에 폼 배치 */}
        <div
          className="absolute"
          style={{ left: "8.5%", top: "40.5%", width: "29%" }}
        >
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
