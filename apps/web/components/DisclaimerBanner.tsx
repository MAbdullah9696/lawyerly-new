import { DISCLAIMER_FOOTER } from "@/lib/constants";

/** Sticky AI-disclaimer banner pinned to the bottom of every public page (§1/§6). */
export function DisclaimerBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-800 bg-navy-950/95 backdrop-blur supports-[backdrop-filter]:bg-navy-950/80">
      <div className="container-page flex items-center gap-3 py-2.5">
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-gold-400" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 5a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0V7Zm-1 7.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" clipRule="evenodd" />
        </svg>
        <p className="text-xs leading-snug text-navy-100">{DISCLAIMER_FOOTER}</p>
      </div>
    </div>
  );
}
