import type { MetadataRoute } from "next";

/**
 * Web app manifest — what makes the portal installable to a home screen.
 *
 * The audience is families and staff on phones, so the installed app opens
 * straight into the private portal — a warm session lands on the account, and
 * only a cold reopen (or a session left idle past its window) bounces to sign-in
 * and comes back, per the auto-lock rules. The portal shell streams instantly,
 * so neither path blocks on the remote DB. The public marketing site is still
 * reachable, but it is not the point of installing.
 *
 * Colours match the construction-paper palette and the root viewport
 * theme-colour, so the splash and status bar are the same paper the app is.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rihana Montessori Academy",
    short_name: "Rihana",
    description:
      "Photos, albums, announcements and pickup for Rihana families — private to each family.",
    id: "/portal",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF9EF",
    theme_color: "#FFF9EF",
    lang: "en",
    dir: "ltr",
    categories: ["education", "kids"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Screenshots power the richer install dialog. One `wide` (desktop) and one
    // narrow (phone) are needed, or Chrome warns and falls back to the plain
    // prompt. Placeholder captures of the marketing home — swap for portal
    // screenshots when the nursery's real content is in.
    screenshots: [
      {
        src: "/screenshots/wide.png",
        sizes: "1280x800",
        type: "image/png",
        form_factor: "wide",
        label: "Rihana on desktop",
      },
      {
        src: "/screenshots/narrow.png",
        sizes: "412x900",
        type: "image/png",
        form_factor: "narrow",
        label: "Rihana on a phone",
      },
    ],
  };
}
