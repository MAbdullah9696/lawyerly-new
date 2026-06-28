/** Reference lists from CLAUDE.md §4. Kept client-side for form dropdowns. */

export const PROVINCES = [
  "Punjab",
  "Sindh",
  "KPK",
  "Balochistan",
  "AJK",
  "GB",
  "Federal",
] as const;

export const PRACTICE_AREAS = [
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Property & Real Estate",
  "Corporate & Business",
  "Constitutional Law",
  "Intellectual Property",
  "Labour Law",
  "Immigration",
  "Cyber Law",
] as const;

export const LANGUAGES = [
  "English",
  "Urdu",
  "Punjabi",
  "Sindhi",
  "Pashto",
  "Balochi",
] as const;

export const EXPERIENCE_BANDS = ["1-5", "6-10", "11-20", "20+"] as const;

/** Lawyer document requirements (§7.2 step 3). */
export const LAWYER_DOCS = [
  { key: "bar_council_cert", label: "Bar Council Certificate", accept: ".pdf,.jpg,.jpeg,.png", maxMB: 5 },
  { key: "cnic_front", label: "CNIC (Front)", accept: ".jpg,.jpeg,.png", maxMB: 3 },
  { key: "cnic_back", label: "CNIC (Back)", accept: ".jpg,.jpeg,.png", maxMB: 3 },
  { key: "law_degree", label: "Law Degree Certificate", accept: ".pdf,.jpg,.jpeg,.png", maxMB: 5 },
  { key: "profile_photo", label: "Profile Photo", accept: ".jpg,.jpeg,.png", maxMB: 2 },
] as const;

export type LawyerDocKey = (typeof LAWYER_DOCS)[number]["key"];

export const DISCLAIMER_FOOTER =
  "AI guidance on this platform is for informational purposes only and does not constitute legal advice.";
