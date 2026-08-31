// The partner site: the operating detail this page gestures at, held behind a
// shared access phrase. "Learn more" sends people there rather than opening a
// blank email, so an interested partner can look before they write.
export const PARTNER_SITE = "https://praxis-partners-swart.vercel.app/";

// Every enquiry the public site produces goes to the operations desk.
export const OPS_EMAIL = "operations@praxisrobotics.io";

export const STATS = {
  continents: "5 continents",
  workers: "60,000 workers",
  environments: "150+ environments",
  markets: "UK · INDIA · TANZANIA · PERU · +1",
  liveCount: "12 LIVE",
};

export interface Clip {
  id: string;
  /** Country / market. */
  location: string;
  /** Environment or task. */
  env: string;
  /** Sector tag (mono). */
  tag: string;
  /**
   * Path/URL to the capability clip. Leave empty until footage is ready —
   * the UI renders a styled "footage coming soon" placeholder when empty.
   * Drop an .mp4 here (e.g. "/clips/india-diamond.mp4") to go live.
   */
  src?: string;
  /** Optional poster image shown before the clip plays. */
  poster?: string;
}

export const CLIPS: Clip[] = [
  {
    id: "india-diamond",
    location: "India",
    env: "Diamond cutting & polishing",
    tag: "Precision manipulation",
  },
  {
    id: "uk-refinery",
    location: "United Kingdom",
    env: "Oil refinery rounds",
    tag: "Heavy industrial",
  },
  {
    id: "tz-bottling",
    location: "Tanzania",
    env: "Beverage bottling line",
    tag: "Line operation",
  },
  {
    id: "peru-mining",
    location: "Peru",
    env: "Mining operations",
    tag: "Heavy industrial",
  },
  {
    id: "uk-care",
    location: "United Kingdom",
    env: "Residential care",
    tag: "Care · residential",
  },
  {
    id: "india-textiles",
    location: "India",
    env: "Textiles & fabric handling",
    tag: "Light manufacturing",
  },
  {
    id: "tz-assembly",
    location: "Tanzania",
    env: "Motorcycle assembly",
    tag: "Assembly",
  },
  {
    id: "india-pharma",
    location: "India",
    env: "Pharma cleanroom",
    tag: "Cleanroom process",
  },
  {
    id: "tz-field",
    location: "Tanzania",
    env: "Field electrical",
    tag: "Skilled trades",
  },
  {
    id: "india-residential",
    location: "India",
    env: "Domestic tasks",
    tag: "Household manipulation",
  },
  {
    id: "tz-textiles",
    location: "Tanzania",
    env: "Sewing & cutting",
    tag: "Light manufacturing",
  },
  {
    id: "peru-maintenance",
    location: "Peru",
    env: "Mining maintenance",
    tag: "Skilled trades",
  },
];
