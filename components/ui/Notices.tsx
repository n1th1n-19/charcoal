import { safePixels, TooLarge } from "@/lib/config";

type Props = { error: string; tooLarge: TooLarge | null; onReduce: () => void; onCancel: () => void };

export default function Notices({ error, tooLarge, onReduce, onCancel }: Props) {
  return (
    <>
    {error && (
      <p role="alert" className="bg-sheet text-sanguine border-sanguine fixed top-3 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 border px-4 py-2">
        {error}
      </p>
    )}
    {tooLarge && (
      <div role="alert" className="bg-sheet border-char fixed top-3 left-1/2 z-40 flex w-[min(90vw,32rem)] -translate-x-1/2 flex-col gap-2 border-2 p-4">
        <p>
          {tooLarge.name} is {Math.round((tooLarge.w * tooLarge.h) / 1e6)} MP, more than this device can safely process. Your original file stays unchanged.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onReduce} className="bg-char text-sheet min-h-11 px-4 font-semibold">
            Convert at {Math.round(safePixels() / 1e6)} MP
          </button>
          <button type="button" onClick={onCancel} className="border-char min-h-11 border px-4 font-medium">
            Cancel
          </button>
        </div>
      </div>
    )}
    </>
  );
}
