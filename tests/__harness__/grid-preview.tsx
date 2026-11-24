/**
 * Screenshot harness (not a test: no `.test.` suffix, so vitest never collects
 * it). Server-renders the REAL AvailabilityHourlyGrid for an HKT-default tutor
 * and for a Sydney tutor, so the #798 zone remap can be eyeballed and captured
 * without a database:
 *
 *   npx vite-node tests/__harness__/grid-preview.tsx > /tmp/grid.html
 */
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";

import i18n from "../../src/features/i18n/config";
import { AvailabilityHourlyGrid } from "../../src/features/tutors/availability-hourly-grid";
import {
  emptyHourlyOpenHours,
  type HourlyOpenHours,
} from "../../src/features/tutors/availability-grid-model";

const open: HourlyOpenHours = emptyHourlyOpenHours();
// A tutor who teaches Mon/Tue evenings and Saturday mornings, in HKT.
open.mon = [18, 19, 20];
open.tue = [18, 19, 20];
open.sat = [9, 10, 11];
open.sun = [22, 23];

const css = `
  body { font-family: system-ui, sans-serif; background: #fff; margin: 0; padding: 28px; color: #0f1419; }
  .wrap { max-width: 760px; margin: 0 auto 44px; }
  h2 { font-size: 15px; letter-spacing: .01em; margin: 0 0 4px; }
  h3 { font-size: 12px; font-weight: 500; color: #536471; margin: 0 0 14px; }
  table { border-collapse: separate; }
  .mm-section { border: 1px solid #e6e7e8; border-radius: 14px; padding: 16px; }
  * { box-sizing: border-box; }
  /* Layout parity for the screenshot only: the app compiles these utilities
     with Tailwind, this harness loads no stylesheet. */
  table { width: 100%; border-spacing: 4px; text-align: center; }
  th { font-size: 11px; }
  td { height: 22px; }
  td > div, td > a { display: block; height: 22px; width: 100%; border-radius: 4px; border: 1px solid transparent; }
  td > div[class*="brand-link"], td > a[class*="brand-link"] { background: #1d9bf0; border-color: rgba(29,155,240,.4); }
  td > div[class*="muted"] { background: #f4f5f6; border-color: #e6e7e8; }
  p { margin: 0 0 8px; font-size: 11px; color: #536471; }
`;

function page(title: string, sub: string, markup: string) {
  return `<section class="wrap"><h2>${title}</h2><h3>${sub}</h3><div class="mm-section">${markup}</div></section>`;
}

const hkt = renderToStaticMarkup(
  <I18nextProvider i18n={i18n}>
    <AvailabilityHourlyGrid
      openHours={open}
      occupiedHours={emptyHourlyOpenHours()}
      tutorCode="MM-T001"
      allowPrefill={false}
      timezone="Asia/Hong_Kong"
      viewerTimezone="Asia/Hong_Kong"
    />
  </I18nextProvider>,
);

const sydney = renderToStaticMarkup(
  <I18nextProvider i18n={i18n}>
    <AvailabilityHourlyGrid
      openHours={open}
      occupiedHours={emptyHourlyOpenHours()}
      tutorCode="MM-T001"
      allowPrefill={false}
      timezone="Australia/Sydney"
      viewerTimezone="Asia/Hong_Kong"
    />
  </I18nextProvider>,
);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body>
${page(
  "Existing tutor · tutors.timezone = Asia/Hong_Kong",
  "Unchanged: Mon/Tue 18:00, 19:00, 20:00 and Sat 09:00–12:00, note still reads “All times in HKT”.",
  hkt,
)}
${page(
  "Sydney tutor · tutors.timezone = Australia/Sydney (viewed from Hong Kong)",
  "Same stored rows read in Sydney (+11): the evening cells land at 21:00–23:00, the Saturday morning band at 12:00–14:00, and Sunday 22:00–23:59 moves onto the Monday column. Converted grids show the whole day so the wrapped band has no hole.",
  sydney,
)}
</body></html>`;

process.stdout.write(html);
