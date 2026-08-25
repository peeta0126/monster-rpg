import { useAudioStore } from "../audio";
import { Panel } from "./Panel";
import { PixelButton } from "./PixelButton";
import { PixelIcon } from "./PixelIcon";

function VolumeRow({
  label, value, onChange, disabled,
}: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <label className="block">
      {/* 이름과 값을 슬라이더 위로 올린다. 한 줄에 셋을 두면 띠가 좁은 화면에서
          슬라이더만 눌려 손가락만 해진다 — 줄일 데가 거기밖에 없어서다. */}
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-pixel-sm text-sand-300">{label}</span>
        <span className="font-mono text-pixel-sm text-sand-200">{Math.round(value * 100)}</span>
      </span>
      {/* min-w-0: 없으면 range 의 기본 폭(≈130px)이 최소치가 돼 좁은 띠에서 줄이 삐져나간다 */}
      <input
        type="range" min={0} max={100} step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="mt-1 h-1.5 w-full min-w-0 cursor-pointer appearance-none rounded-full
          bg-shadow-700 accent-ember-500 disabled:opacity-40"
      />
    </label>
  );
}

/**
 * 소리 설정. 메뉴 안에서 펼쳐지니까 메뉴 폭 안에 들어가야 한다. 그 폭은 그림 옆
 * 띠가 정하고(`StageRail`), 좁은 화면에서는 136px 까지 줄어든다.
 * 그래서 고정 폭 없이 전부 w-full 로 세로로 쌓는다.
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
