import { CURRENT_TERMS_VERSION } from '@ella/shared'

export type TermsLanguage = 'EN' | 'VI'

export interface TermsSection {
  heading: string
  paragraphs: string[]
}

export interface TermsContent {
  title: string
  version: string
  effectiveDate: string
  sections: TermsSection[]
  acknowledgment: string
}

/** Derive effectiveDate from version string (YYYY.MM.DD) */
function formatEffectiveDate(version: string, lang: TermsLanguage): string {
  const [year, month, day] = version.split('.').map(Number)
  const date = new Date(year, month - 1, day)
  if (lang === 'VI') {
    return `${day} th\u00E1ng ${month}, ${year}`
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export const TERMS_CONTENT: Record<TermsLanguage, TermsContent> = {
  EN: {
    title: 'Staff Terms and Conditions',
    version: CURRENT_TERMS_VERSION,
    effectiveDate: formatEffectiveDate(CURRENT_TERMS_VERSION, 'EN'),
    sections: [
      {
        heading: '1. Acceptance of Terms',
        paragraphs: [
          'By accessing and using the Ella workspace platform, you agree to be bound by these Terms and Conditions.',
          'If you do not agree to these terms, you may not access or use the platform.',
        ],
      },
      {
        heading: '2. Confidentiality',
        paragraphs: [
          'You agree to maintain strict confidentiality of all client information, tax documents, and financial data accessed through this platform.',
          'Unauthorized disclosure of client information is prohibited and may result in termination and legal action.',
        ],
      },
      {
        heading: '3. Data Protection',
        paragraphs: [
          'You must handle all personal and financial data in accordance with applicable privacy laws and company policies.',
          'You agree not to export, copy, or transfer client data outside of authorized systems.',
        ],
      },
      {
        heading: '4. Professional Conduct',
        paragraphs: [
          'You agree to conduct yourself professionally and ethically when interacting with clients and colleagues.',
          'You will follow all established procedures for document handling, verification, and tax preparation.',
        ],
      },
      {
        heading: '5. System Security',
        paragraphs: [
          'You agree not to share your login credentials with anyone.',
          'You must report any security incidents or suspicious activities immediately.',
          'You will log out of the system when not in use.',
        ],
      },
      {
        heading: '6. Termination',
        paragraphs: [
          'Your access may be terminated at any time for violation of these terms.',
          'Upon termination, you must cease all use of the platform and return any company property.',
        ],
      },
    ],
    acknowledgment: 'I have read, understood, and agree to be bound by these Terms and Conditions.',
  },
  VI: {
    title: '\u0110i\u1EC1u Kho\u1EA3n v\u00E0 \u0110i\u1EC1u Ki\u1EC7n Nh\u00E2n Vi\u00EAn',
    version: CURRENT_TERMS_VERSION,
    effectiveDate: formatEffectiveDate(CURRENT_TERMS_VERSION, 'VI'),
    sections: [
      {
        heading: '1. Ch\u1EA5p Nh\u1EADn \u0110i\u1EC1u Kho\u1EA3n',
        paragraphs: [
          'B\u1EB1ng vi\u1EC7c truy c\u1EADp v\u00E0 s\u1EED d\u1EE5ng n\u1EC1n t\u1EA3ng Ella workspace, b\u1EA1n \u0111\u1ED3ng \u00FD tu\u00E2n theo c\u00E1c \u0110i\u1EC1u Kho\u1EA3n v\u00E0 \u0110i\u1EC1u Ki\u1EC7n n\u00E0y.',
          'N\u1EBFu b\u1EA1n kh\u00F4ng \u0111\u1ED3ng \u00FD v\u1EDBi c\u00E1c \u0111i\u1EC1u kho\u1EA3n n\u00E0y, b\u1EA1n kh\u00F4ng \u0111\u01B0\u1EE3c truy c\u1EADp ho\u1EB7c s\u1EED d\u1EE5ng n\u1EC1n t\u1EA3ng.',
        ],
      },
      {
        heading: '2. B\u1EA3o M\u1EADt Th\u00F4ng Tin',
        paragraphs: [
          'B\u1EA1n \u0111\u1ED3ng \u00FD b\u1EA3o m\u1EADt nghi\u00EAm ng\u1EB7t t\u1EA5t c\u1EA3 th\u00F4ng tin kh\u00E1ch h\u00E0ng, t\u00E0i li\u1EC7u thu\u1EBF v\u00E0 d\u1EEF li\u1EC7u t\u00E0i ch\u00EDnh \u0111\u01B0\u1EE3c truy c\u1EADp th\u00F4ng qua n\u1EC1n t\u1EA3ng n\u00E0y.',
          'Vi\u1EC7c ti\u1EBFt l\u1ED9 tr\u00E1i ph\u00E9p th\u00F4ng tin kh\u00E1ch h\u00E0ng b\u1ECB c\u1EA5m v\u00E0 c\u00F3 th\u1EC3 d\u1EABn \u0111\u1EBFn ch\u1EA5m d\u1EE9t h\u1EE3p \u0111\u1ED3ng v\u00E0 h\u00E0nh \u0111\u1ED9ng ph\u00E1p l\u00FD.',
        ],
      },
      {
        heading: '3. B\u1EA3o V\u1EC7 D\u1EEF Li\u1EC7u',
        paragraphs: [
          'B\u1EA1n ph\u1EA3i x\u1EED l\u00FD t\u1EA5t c\u1EA3 d\u1EEF li\u1EC7u c\u00E1 nh\u00E2n v\u00E0 t\u00E0i ch\u00EDnh theo lu\u1EADt b\u1EA3o m\u1EADt hi\u1EC7n h\u00E0nh v\u00E0 ch\u00EDnh s\u00E1ch c\u00F4ng ty.',
          'B\u1EA1n \u0111\u1ED3ng \u00FD kh\u00F4ng xu\u1EA5t, sao ch\u00E9p ho\u1EB7c chuy\u1EC3n d\u1EEF li\u1EC7u kh\u00E1ch h\u00E0ng ra ngo\u00E0i c\u00E1c h\u1EC7 th\u1ED1ng \u0111\u01B0\u1EE3c \u1EE7y quy\u1EC1n.',
        ],
      },
      {
        heading: '4. \u1EE8ng X\u1EED Chuy\u00EAn Nghi\u1EC7p',
        paragraphs: [
          'B\u1EA1n \u0111\u1ED3ng \u00FD h\u00E0nh x\u1EED chuy\u00EAn nghi\u1EC7p v\u00E0 c\u00F3 \u0111\u1EA1o \u0111\u1EE9c khi t\u01B0\u01A1ng t\u00E1c v\u1EDBi kh\u00E1ch h\u00E0ng v\u00E0 \u0111\u1ED3ng nghi\u1EC7p.',
          'B\u1EA1n s\u1EBD tu\u00E2n theo t\u1EA5t c\u1EA3 c\u00E1c quy tr\u00ECnh \u0111\u00E3 thi\u1EBFt l\u1EADp v\u1EC1 x\u1EED l\u00FD t\u00E0i li\u1EC7u, x\u00E1c minh v\u00E0 chu\u1EA9n b\u1ECB thu\u1EBF.',
        ],
      },
      {
        heading: '5. B\u1EA3o M\u1EADt H\u1EC7 Th\u1ED1ng',
        paragraphs: [
          'B\u1EA1n \u0111\u1ED3ng \u00FD kh\u00F4ng chia s\u1EBB th\u00F4ng tin \u0111\u0103ng nh\u1EADp v\u1EDBi b\u1EA5t k\u1EF3 ai.',
          'B\u1EA1n ph\u1EA3i b\u00E1o c\u00E1o ngay l\u1EADp t\u1EE9c b\u1EA5t k\u1EF3 s\u1EF1 c\u1ED1 b\u1EA3o m\u1EADt ho\u1EB7c ho\u1EA1t \u0111\u1ED9ng \u0111\u00E1ng ng\u1EDD n\u00E0o.',
          'B\u1EA1n s\u1EBD \u0111\u0103ng xu\u1EA5t kh\u1ECFi h\u1EC7 th\u1ED1ng khi kh\u00F4ng s\u1EED d\u1EE5ng.',
        ],
      },
      {
        heading: '6. Ch\u1EA5m D\u1EE9t',
        paragraphs: [
          'Quy\u1EC1n truy c\u1EADp c\u1EE7a b\u1EA1n c\u00F3 th\u1EC3 b\u1ECB ch\u1EA5m d\u1EE9t b\u1EA5t c\u1EE9 l\u00FAc n\u00E0o n\u1EBFu vi ph\u1EA1m c\u00E1c \u0111i\u1EC1u kho\u1EA3n n\u00E0y.',
          'Khi ch\u1EA5m d\u1EE9t, b\u1EA1n ph\u1EA3i ng\u1EEBng s\u1EED d\u1EE5ng n\u1EC1n t\u1EA3ng v\u00E0 tr\u1EA3 l\u1EA1i b\u1EA5t k\u1EF3 t\u00E0i s\u1EA3n c\u00F4ng ty n\u00E0o.',
        ],
      },
    ],
    acknowledgment: 'T\u00F4i \u0111\u00E3 \u0111\u1ECDc, hi\u1EC3u v\u00E0 \u0111\u1ED3ng \u00FD tu\u00E2n theo c\u00E1c \u0110i\u1EC1u Kho\u1EA3n v\u00E0 \u0110i\u1EC1u Ki\u1EC7n n\u00E0y.',
  },
}
