/**
 * iOS launch-image links.
 *
 * iOS only shows a branded launch screen for an installed web app when TWO
 * things are true: the page declares the legacy `apple-mobile-web-app-capable`
 * meta (Next 16 emits only the newer `mobile-web-app-capable`, which iOS ignores
 * for this purpose — so we add the apple- one here ourselves), and there is an
 * `apple-touch-startup-image` link whose media query matches the device's exact
 * metrics. Miss either and iOS falls back to a black frame. One link per device
 * (see DEVICES), pointing at the images `npm run splash:generate` writes to
 * /public/splash — keep this list in step with scripts/generate-splash.ts.
 *
 * The media query is written without a `screen and` prefix, which is the form
 * iOS reliably matches. These are <meta>/<link> tags, so React hoists them into
 * <head> from wherever the component renders; it lives in the root layout.
 */

// [cssWidth, cssHeight, devicePixelRatio], portrait.
const DEVICES: Array<[number, number, number]> = [
  [320, 568, 2],
  [375, 667, 2],
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 736, 3],
  [414, 896, 2],
  [414, 896, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];

export function AppleSplash() {
  return (
    <>
      {/* The tag iOS needs to treat this as a launchable web app and honour the
          startup images below. Next only emits the newer `mobile-web-app-capable`. */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      {DEVICES.map(([w, h, r]) => (
        <link
          key={`${w}x${h}@${r}`}
          rel="apple-touch-startup-image"
          media={`(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`}
          href={`/splash/splash-${w * r}x${h * r}.png`}
        />
      ))}
    </>
  );
}
