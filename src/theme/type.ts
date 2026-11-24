/**
 * Dyslexia-friendly type scale — large sizes, generous line-height, high contrast.
 * No custom font files in-app yet; keep system stack and lead with weight / size.
 */
export const type = {
  hero: { fontSize: 28, lineHeight: 34, fontWeight: '900' as const, letterSpacing: 0.2 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.2 },
  section: { fontSize: 18, lineHeight: 26, fontWeight: '800' as const, letterSpacing: 0.15 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '800' as const },
  meta: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  kicker: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
} as const;
