"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { lawyersApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";
import { StarRating, AvailabilityDot, Avatar } from "@/components/user/widgets";
import { PRACTICE_AREAS, LANGUAGES } from "@/lib/constants";
import type { LawyerCard as LawyerCardT, LawyerListResult } from "@/lib/types";

const SORTS = [
  { value: "relevant", label: "Most Relevant" },
  { value: "rating", label: "Highest Rated" },
  { value: "fee_low", label: "Lowest Fee" },
  { value: "fee_high", label: "Highest Fee" },
  { value: "experience", label: "Most Experienced" },
  { value: "reviews", label: "Most Reviews" },
];
const EXPERIENCE = ["Any", "1-5", "6-10", "11+"] as const;
const RATINGS = [{ v: 0, l: "Any" }, { v: 3, l: "3+ ★" }, { v: 4, l: "4+ ★" }, { v: 5, l: "5 ★" }];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white text-navy-600 hover:border-navy-400"}`}
    >
      {children}
    </button>
  );
}

function LawyerCard({ l }: { l: LawyerCardT }) {
  return (
    <div className="flex flex-col rounded-2xl border border-navy-100 bg-white p-5 shadow-card transition hover:shadow-card-lg">
      <div className="flex items-start gap-3">
        <Avatar name={l.fullName} url={l.photoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-navy-900">{l.fullName}</h3>
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-green-600" fill="currentColor" aria-label="Verified"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 10a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" /></svg>
          </div>
          <p className="text-xs text-navy-500">{l.city}, {l.province}</p>
          <div className="mt-1 flex items-center gap-2">
            <StarRating value={l.ratingAvg} />
            <span className="text-xs text-navy-400">({l.reviewCount})</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {l.practiceAreas.slice(0, 3).map((p) => (
          <span key={p} className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-600">{p}</span>
        ))}
        {l.practiceAreas.length > 3 && <span className="px-1 text-xs text-navy-400">+{l.practiceAreas.length - 3} more</span>}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3">
        <div>
          <p className="text-xs text-navy-400">{l.experienceLabel}</p>
          <p className="font-semibold text-navy-900">PKR {l.consultationFeePkr.toLocaleString()}</p>
        </div>
        <AvailabilityDot status={l.availability} />
      </div>
      <Link href={`/user/lawyer/${l.id}`} className="btn-primary mt-4 w-full">View Profile</Link>
    </div>
  );
}

function FindLawyerInner() {
  const params = useSearchParams();
  const initialArea = params.get("practiceArea");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [areas, setAreas] = useState<string[]>(initialArea ? [initialArea] : []);
  const [langs, setLangs] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [maxFee, setMaxFee] = useState(50000);
  const [experience, setExperience] = useState<(typeof EXPERIENCE)[number]>("Any");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("relevant");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<LawyerListResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(1); }, [debouncedQ, areas, langs, city, maxFee, experience, minRating, sort]);

  const queryParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      practiceArea: areas.join(",") || undefined,
      language: langs.join(",") || undefined,
      city: city || undefined,
      maxFee: maxFee < 50000 ? maxFee : undefined,
      experience: experience !== "Any" ? experience : undefined,
      minRating: minRating || undefined,
      sort,
      page,
    }),
    [debouncedQ, areas, langs, city, maxFee, experience, minRating, sort, page],
  );

  useEffect(() => {
    setLoading(true);
    lawyersApi.list(queryParams).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [queryParams]);

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  function clearAll() {
    setQ(""); setAreas([]); setLangs([]); setCity(""); setMaxFee(50000); setExperience("Any"); setMinRating(0); setSort("relevant");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-navy-900">Find a Lawyer</h1>
      <p className="mt-1 text-navy-500">Browse verified, Bar Council–certified lawyers.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="space-y-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card lg:sticky lg:top-20 lg:self-start">
          <div>
            <label className="field-label">Practice Areas</label>
            <div className="flex flex-wrap gap-1.5">
              {PRACTICE_AREAS.map((p) => <Pill key={p} active={areas.includes(p)} onClick={() => toggle(areas, setAreas, p)}>{p}</Pill>)}
            </div>
          </div>
          <div>
            <label className="field-label">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lahore" className="field-input" />
          </div>
          <div>
            <label className="field-label">Languages</label>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((p) => <Pill key={p} active={langs.includes(p)} onClick={() => toggle(langs, setLangs, p)}>{p}</Pill>)}
            </div>
          </div>
          <div>
            <label className="field-label">Max Fee: PKR {maxFee.toLocaleString()}</label>
            <input type="range" min={0} max={50000} step={500} value={maxFee} onChange={(e) => setMaxFee(Number(e.target.value))} className="w-full accent-navy-900" />
          </div>
          <div>
            <label className="field-label">Experience</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPERIENCE.map((e) => <Pill key={e} active={experience === e} onClick={() => setExperience(e)}>{e === "Any" ? "Any" : `${e} yrs`}</Pill>)}
            </div>
          </div>
          <div>
            <label className="field-label">Rating</label>
            <div className="flex flex-wrap gap-1.5">
              {RATINGS.map((r) => <Pill key={r.v} active={minRating === r.v} onClick={() => setMinRating(r.v)}>{r.l}</Pill>)}
            </div>
          </div>
          <button onClick={clearAll} className="text-sm font-semibold text-navy-600 hover:text-navy-900">Clear all filters</button>
        </aside>

        {/* Results */}
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3" strokeLinecap="round" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="field-input pl-9" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-input sm:w-52">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>
          ) : !data || data.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-navy-200 py-16 text-center">
              <p className="text-navy-500">No lawyers match your filters.</p>
              <button onClick={clearAll} className="btn-outline mt-4">Clear all filters</button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-navy-400">{data.total} lawyer{data.total !== 1 ? "s" : ""} found</p>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((l) => <LawyerCard key={l.id} l={l} />)}
              </div>
              {data.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-outline disabled:opacity-40">Previous</button>
                  <span className="px-3 text-sm text-navy-500">Page {data.page} of {data.totalPages}</span>
                  <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-outline disabled:opacity-40">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FindLawyerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <FindLawyerInner />
    </Suspense>
  );
}
