// User agent-ийг "Chrome 131 · macOS" хэлбэрт товчилно (сан ашиглахгүй, ойролцоо).
const BROWSERS = [
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /OPR\/(\d+)/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
  ["Safari", /Version\/(\d+).*Safari/],
];
const SYSTEMS = [
  ["iOS", /iPhone|iPad|iPod/],
  ["Android", /Android/],
  ["Windows", /Windows/],
  ["macOS", /Mac OS X|Macintosh/],
  ["Linux", /Linux/],
];

export function describeUserAgent(userAgent) {
  if (!userAgent) return null;
  const browser = BROWSERS.find(([, pattern]) => pattern.test(userAgent));
  const system = SYSTEMS.find(([, pattern]) => pattern.test(userAgent));
  const parts = [
    browser ? `${browser[0]} ${userAgent.match(browser[1])[1]}` : null,
    system?.[0],
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Тодорхойгүй";
}
