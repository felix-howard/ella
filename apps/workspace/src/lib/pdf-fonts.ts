import { Font } from '@react-pdf/renderer'

// Self-hosted fonts for Vietnamese diacritic support
const FONT_BASE = '/fonts'

Font.register({
  family: 'Noto Sans',
  fonts: [
    {
      src: `${FONT_BASE}/NotoSans-Regular.ttf`,
      fontWeight: 400,
    },
    {
      src: `${FONT_BASE}/NotoSans-Bold.ttf`,
      fontWeight: 700,
    },
  ],
})

export const PDF_FONT_FAMILY = 'Noto Sans'
