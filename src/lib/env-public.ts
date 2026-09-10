/**
 * Values safe to expose to the browser. Read directly from NEXT_PUBLIC_*
 * variables so no server-only module ever ends up in a client bundle.
 */
export const publicEnv = {
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  realtime: {
    driver: process.env.NEXT_PUBLIC_REALTIME_DRIVER ?? "none",
    key: process.env.NEXT_PUBLIC_REALTIME_KEY ?? "",
    cluster: process.env.NEXT_PUBLIC_REALTIME_CLUSTER ?? "mt1",
  },
  billingProvider: process.env.NEXT_PUBLIC_BILLING_PROVIDER ?? "none",
  auth: {
    googleEnabled: process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true",
    githubEnabled: process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true",
  },
  platformName: "Nexora",
} as const;
