"use client";

import Script from "next/script";
import { gaMeasurementId } from "@/lib/analytics";

/**
 * Loads GA4 (gtag), and only ever when a measurement id is set.
 *
 * With no id this renders null: no <script> reaches the page, no request goes
 * to Google, and window.gtag stays undefined, which is what makes every track()
 * call downstream a no-op. The id is never hard-coded, it comes from
 * NEXT_PUBLIC_GA_MEASUREMENT_ID, so a build without it ships an analytics-free
 * site with no code change.
 *
 * afterInteractive: load early but after hydration, the standard for a page-view
 * tracker that must not block first paint. The inline init defines gtag and
 * configures the property; the id must be assigned so Next can track the inline
 * script.
 */
export function Analytics() {
  const measurementId = gaMeasurementId();
  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  );
}
