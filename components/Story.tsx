import Sumi from "@/components/Sumi";

export const STORY = [
  { title: "The branch", text: "Every drawing begins as something living. A willow branch falls, still holding its rings." },
  { title: "The fire", text: "Sealed away from air, the wood cannot burn. It gives up its water and smoke, until only carbon stays." },
  { title: "The mark", text: "Now the stick meets the sheet. Every dark grain is a choice, and what you leave empty becomes the light." },
  { title: "The keeping", text: "Charcoal lifts at a touch, so artists fix it to the page. Your drawing is ready to carry." },
];

// One chapter: an ink wash scene and text the station writes in word by word.
export default function Story({ chapter, compact, className = "" }: { chapter: number; compact?: boolean; className?: string }) {
  const { title, text } = STORY[chapter];
  return (
    <section data-story aria-label={`Chapter ${chapter + 1}, ${title}`} className={`flex max-w-[38ch] gap-3 md:flex-col ${className}`}>
      <div className={`relative size-20 shrink-0 short:hidden flat:hidden md:size-36 ${compact ? "hidden xl:block" : ""}`}>
        <Sumi chapter={chapter} />
      </div>
      <div className="min-w-0">
        <p className="text-label text-sanguine font-bold">
          Chapter {chapter + 1}, {title}
        </p>
        <p className="text-soft short:text-sm mt-1 leading-snug" style={{ fontVariationSettings: '"CASL" 1, "slnt" -12' }}>
          {text.split(" ").map((word, i) => (
            <span key={i} data-word className="inline-block">{word}&nbsp;</span>
          ))}
        </p>
      </div>
    </section>
  );
}
