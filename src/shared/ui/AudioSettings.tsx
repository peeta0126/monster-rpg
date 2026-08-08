import { useAudioStore } from "../audio";
import { Panel } from "./Panel";
import { PixelButton } from "./PixelButton";

function VolumeRow({
  label, value, onChange, disabled,
}: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-pixel-sm text-sand-300">{label}</span>
      <input
        type="range" min={0} max={100} step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-shadow-700
          accent-ember-500 disabled:opacity-40"
      />
      <span className="w-10 shrink-0 text-right font-mono text-pixel-sm text-sand-200">
        {Math.round(value * 100)}
      </span>
    </label>
  );
}

/** 소리 설정. 메뉴에서 연다. */
export function AudioSettings() {
  const { bgmVolume, sfxVolume, muted, setBgmVolume, setSfxVolume, setMuted } = useAudioStore();

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">SOUND</p>
        <PixelButton
          variant={muted ? "danger" : "ghost"}
          onClick={() => setMuted(!muted)}
        >
          {muted ? "🔇 음소거 해제" : "🔈 전체 음소거"}
        </PixelButton>
      </div>

      <VolumeRow label="BGM"   value={bgmVolume} onChange={setBgmVolume} disabled={muted} />
      <VolumeRow label="효과음" value={sfxVolume} onChange={setSfxVolume} disabled={muted} />

      <p className="text-pixel-sm text-earth-400">
        사운드 에셋은 아직 준비 중입니다. 설정은 저장됩니다.
      </p>
    </Panel>
  );
}
