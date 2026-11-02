import { Kiln } from "@/components/Sketches";
import Story from "@/components/Story";
import Progress from "@/components/ui/Progress";
import { ProgressState, STATION } from "@/lib/config";

type Props = { temp: number; lit: number; download: string; progress: ProgressState; removeBg: boolean; stages: string[] };

export default function KilnStation({ temp, lit, download, progress, removeBg, stages: STAGES }: Props) {
  return (
      <section aria-label="Kiln" className={`${STATION} flex-col gap-4 flat:flex-row-reverse flat:p-3 md:flex-row-reverse md:items-center wide:grid wide:grid-cols-[17rem_minmax(0,1fr)_17rem] wide:gap-6`}>
        <div className="min-h-0 flex-1 self-stretch pt-[16vh] phone:pt-[9dvh] flat:pt-[14dvh] wide:col-start-2 wide:row-start-1 wide:translate-x-[12%]"><Kiln temp={temp} /></div>
        <div className="flex shrink-0 flex-col gap-2 flat:h-full flat:w-1/2 flat:overflow-y-auto md:w-72 wide:contents">
          <Story chapter={1} className="wide:col-start-1 wide:row-start-1 wide:self-center" />
          <div className="flex flex-col gap-2 wide:col-start-3 wide:row-start-1 wide:self-center">
          <p data-mono className="text-title short:text-2xl font-bold tabular-nums">{temp} C</p>
          <Progress
            name={download ? "Downloading model" : lit >= 0 ? STAGES[lit] : "Waiting for an image"}
            pct={download ? progress.pct : Math.round(((temp - 20) / 880) * 100)}
          />
          {download && <p role="status" className="text-label text-soft">{download}</p>}
          <p className="text-label text-soft hidden phone:block flat:block" aria-live="polite">{lit >= 0 ? STAGES[lit] : "Waiting for an image"}</p>
          <ol className="grid grid-cols-2 gap-x-4 phone:hidden flat:hidden md:grid-cols-1 md:gap-y-1">
            {STAGES.map((s, i) => (i === 0 && !removeBg ? null : (
              <li key={s} aria-current={i === lit ? "step" : undefined} className={i === lit ? "text-sanguine font-bold" : i < lit ? "line-through decoration-1" : "text-soft"}>
                {s}
              </li>
            )))}
          </ol>
          </div>
        </div>
      </section>
  );
}
