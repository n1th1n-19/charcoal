import Link from "next/link";
import { LEGAL_UPDATED, NAME } from "@/lib/site";

// Long text needs vertical scroll, selectable words and no seam across the reading line.
export default function Legal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto select-text">
      <main className="mx-auto flex max-w-[68ch] flex-col gap-4 px-4 py-10 md:py-16 [&_a]:underline [&_h2]:text-heading [&_h2]:mt-4 [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5">
        <Link href="/" className="text-heading font-bold no-underline!">{NAME}</Link>
        <h1 className="text-title font-bold">{title}</h1>
        <p className="text-soft">Last updated {LEGAL_UPDATED}</p>
        {children}
        <nav aria-label="Legal" className="border-char mt-6 flex gap-5 border-t pt-4">
          <Link href="/">Back to {NAME}</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </main>
    </div>
  );
}
