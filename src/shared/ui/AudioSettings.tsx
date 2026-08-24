import { useAudioStore } from "../audio";
import { Panel } from "./Panel";
import { PixelButton } from "./PixelButton";
import { PixelIcon } from "./PixelIcon";

function VolumeRow({
  label, value, onChange, disabled,
}: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-pixel-sm text-sand-300">{label}</span>
      {/* min-w-0: 없으면 range 의 기본 폭(≈130px)이 최소치가 돼 좁은 메뉴에서 줄이 삐져나간다 */}
      <input
        type="range" min={0} max={100} step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-shadow-700
          accent-ember-500 disabled:opacity-40"
      />
      <span className="w-8 shrink-0 text-right font-mono text-pixel-sm text-sand-200">
        {Math.round(value * 100)}
      </span>
    </label>
  );
}

/**
 * 소리 설정. 우상단 메뉴 안에서 펼쳐지므로 메뉴 폭(w-64) 안에 들어가야 한다 —
 * 음소거 버튼을 슬라이더 옆에 두면 슬라이더가 손가락만 해진다. 세로로 쌓는다.
 */
export function AudioSettings() {
  const { bgmVolume, sfxVolume, muted, setBgmVolume, setSfxVolume, setMuted } = useAudioStore();

  return (
    <Panel className="flex flex-col gap-2 p-3">
      <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">SOUND</p>

      <VolumeRow label="BGM"   value={bgmVolume} onChange={setBgmVolume} disabled={muted} />
      <VolumeRow label="효과음" value={sfxVolume} onChange={setSfxVolume} disabled={muted} />

      <PixelButton
        className="w-full"
        variant={muted ? "danger" : "ghost"}
        onClick={() => setMuted(!muted)}
      >
        <span className="inline-flex items-center gap-1.5">
          <PixelIcon name={muted ? "mute" : "sound"} size={16} />
          {muted ? "음소거 해제" : "전체 음소거"}
        </span>
      </PixelButton>

      {/* 배경음은 화면마다 걸려 있고, 효과음은 아직 파일이 없다. 슬라이더 둘 중
          하나만 아무 일도 안 일어나는 상태라 그 사실을 적어 둔다. */}
      <p className="text-pixel-sm text-earth-400">
        효과음은 아직 준비 중입니다. 설정은 저장됩니다.
      </p>
    </Panel>
  );
}
