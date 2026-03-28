import { Font } from '@react-pdf/renderer'

// Self-hosted fonts with CDN fallback for Vietnamese diacritic support
const FONT_BASE = '/fonts'
const CDN_BASE = 'https://fonts.gstatic.com/s/notosans/v42'

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

// Fallback: register CDN source in case local files are missing
Font.register({
  family: 'Noto Sans CDN',
  fonts: [
    {
      src: `${CDN_BASE}/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf`,
      fontWeight: 400,
    },
    {
      src: `${CDN_BASE}/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAaBN9d.ttf`,
      fontWeight: 700,
    },
  ],
})

export const PDF_FONT_FAMILY = 'Noto Sans'
