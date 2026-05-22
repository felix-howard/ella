import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const APPS = ['workspace', 'portal']
const SCAN_TARGETS = [
  'apps/workspace/src',
  'apps/portal/src',
  'apps/api/src',
  'packages/shared/src',
  'packages/db/prisma/seed-checklist-templates.ts',
  'packages/db/prisma/seed-intake-questions.ts',
]

const VIETNAMESE_CHAR_PATTERN =
  /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂạ-ỹ]/u

const EXCLUDED_PATH_PARTS = [
  '/locales/',
  '/generated/',
  '/__tests__/',
  '/__fixtures__/',
  '/fixtures/',
  '/dist/',
]

const EXCLUDED_FILE_PATTERNS = [
  /\.test\.[cm]?[tj]sx?$/u,
  /\.spec\.[cm]?[tj]sx?$/u,
  /\.d\.ts$/u,
]

const ALLOWLIST = [
  {
    pathPrefix: 'apps/workspace/src/components/terms/terms-content.ts',
    reason: 'Staff terms content is an explicit bilingual legal-text catalog.',
  },
  {
    pathPrefix: 'apps/workspace/src/components/shared/send-form-message-modal.tsx',
    reason: 'Schedule C/E form-message defaults are an explicit bilingual SMS catalog.',
  },
  {
    pathPrefix: 'apps/api/src/services/ai/prompts/',
    reason: 'AI OCR/classification prompt catalogs intentionally include Vietnamese labels.',
  },
  {
    pathPrefix: 'apps/api/src/lib/constants.ts',
    reason: 'API domain label catalogs are explicitly bilingual and default to English helpers.',
  },
  {
    pathPrefix: 'apps/api/src/services/ai/ai-error-messages.ts',
    reason: 'AI error message catalogs keep Vietnamese variants while runtime defaults to English.',
  },
  {
    pathPrefix: 'apps/api/src/services/ai/blur-detector.ts',
    reason: 'Image-quality grade compatibility fields retain Vietnamese labels.',
  },
  {
    pathPrefix: 'apps/api/src/services/ai/document-classifier.ts',
    reason: 'Document classifier keeps Vietnamese label catalog for existing call compatibility.',
  },
  {
    pathPrefix: 'apps/api/src/services/checklist/',
    reason: 'Checklist template seed/catalog data is bilingual domain content.',
  },
  {
    pathPrefix: 'apps/api/src/services/document/',
    reason: 'Document type catalogs retain Vietnamese labels for existing API contracts.',
  },
  {
    pathPrefix: 'apps/api/src/services/sms/templates/',
    reason: 'SMS templates are explicit bilingual customer communication catalogs.',
  },
  {
    pathPrefix: 'apps/api/src/services/sms/upload-link-template-resolver.ts',
    reason: 'Upload-link SMS templates are explicit bilingual customer communication catalogs.',
  },
  {
    pathPrefix: 'packages/shared/src/types/doc-category.ts',
    reason: 'Shared document category labels are bilingual catalog data.',
  },
  {
    pathPrefix: 'packages/shared/src/types/schedule-e.ts',
    reason: 'Schedule E property type labels are bilingual catalog data.',
  },
  {
    pathPrefix: 'packages/shared/src/utils/filename-sanitizer.ts',
    reason: 'Filename sanitizer transliterates Vietnamese characters intentionally.',
  },
  {
    pathPrefix: 'packages/db/prisma/seed-intake-questions.ts',
    reason: 'Seed intake questions include stored bilingual labels.',
  },
  {
    pathPrefix: 'packages/db/prisma/seed-checklist-templates.ts',
    reason: 'Seed checklist templates include stored bilingual labels.',
  },
]

const DISALLOWED_FALLBACK_PATTERNS = [
  {
    pattern: /fallbackLng\s*:\s*(?:['"]vi['"]|\[[^\]]*['"]vi['"][^\]]*\])/u,
    message: 'i18n fallback must be English-first.',
  },
  {
    pattern: /(?:\|\||\?\?)\s*TEMPLATES\.VI\b/u,
    message: 'Template fallback must use TEMPLATES.EN.',
  },
]

const mode = parseMode(process.argv.slice(2))
let hasFailures = false

if (mode.check) {
  const parityFailures = checkLocaleParity()
  hasFailures = hasFailures || parityFailures > 0
}

if (mode.scan) {
  const findings = scanVietnameseLiterals()
  const activeFindings = printScanFindings(findings)
  const fallbackFindings = scanDisallowedFallbacks()
  printFallbackFindings(fallbackFindings)
  hasFailures = hasFailures || activeFindings > 0 || fallbackFindings.length > 0
}

if (hasFailures) {
  process.exitCode = 1
}

function parseMode(args) {
  const onlyCheck = args.includes('--check')
  const onlyScan = args.includes('--scan')
  return {
    check: onlyCheck || !onlyScan,
    scan: onlyScan || !onlyCheck,
  }
}

function checkLocaleParity() {
  let failures = 0

  for (const app of APPS) {
    const enPath = path.join(ROOT, 'apps', app, 'src/locales/en.json')
    const viPath = path.join(ROOT, 'apps', app, 'src/locales/vi.json')
    const enKeys = new Set(flattenKeys(readJson(enPath)))
    const viKeys = new Set(flattenKeys(readJson(viPath)))
    const missingVi = [...enKeys].filter((key) => !viKeys.has(key)).sort()
    const missingEn = [...viKeys].filter((key) => !enKeys.has(key)).sort()

    if (missingVi.length === 0 && missingEn.length === 0) {
      console.log(`locale parity: ${app} ok (${enKeys.size} keys)`)
      continue
    }

    failures += missingVi.length + missingEn.length
    console.error(`locale parity: ${app} failed`)
    for (const key of missingVi) console.error(`  missing vi: ${key}`)
    for (const key of missingEn) console.error(`  missing en: ${key}`)
  }

  return failures
}

function flattenKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    return flattenKeys(child, nextPrefix)
  })
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function scanVietnameseLiterals() {
  const findings = []

  for (const target of SCAN_TARGETS) {
    const absoluteTarget = path.join(ROOT, target)
    for (const filePath of walkTarget(absoluteTarget)) {
      const relativePath = toRelative(filePath)
      if (!shouldScanFile(relativePath)) continue

      const allowlistEntry = ALLOWLIST.find((entry) => relativePath.startsWith(entry.pathPrefix))
      const lines = readFileSync(filePath, 'utf8').split(/\r?\n/u)

      lines.forEach((line, index) => {
        const decodedLine = decodeUnicodeEscapes(line)
        const match = VIETNAMESE_CHAR_PATTERN.exec(decodedLine)
        if (!match) return

        findings.push({
          path: relativePath,
          line: index + 1,
          column: match.index + 1,
          allowed: Boolean(allowlistEntry),
          reason: allowlistEntry?.reason,
          text: line.trim().slice(0, 180),
          escaped: decodedLine !== line,
        })
      })
    }
  }

  return findings.sort(compareFindings)
}

function decodeUnicodeEscapes(line) {
  return line
    .replace(/\\u\{([0-9a-fA-F]+)\}/gu, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _
    })
    .replace(/\\u([0-9a-fA-F]{4})/gu, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16)
      return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : _
    })
}

function scanDisallowedFallbacks() {
  const findings = []

  for (const target of SCAN_TARGETS) {
    const absoluteTarget = path.join(ROOT, target)
    for (const filePath of walkTarget(absoluteTarget)) {
      const relativePath = toRelative(filePath)
      if (!shouldScanFile(relativePath)) continue

      const lines = readFileSync(filePath, 'utf8').split(/\r?\n/u)
      lines.forEach((line, index) => {
        for (const { pattern, message } of DISALLOWED_FALLBACK_PATTERNS) {
          const match = pattern.exec(line)
          if (!match) continue
          findings.push({
            path: relativePath,
            line: index + 1,
            column: match.index + 1,
            message,
            text: line.trim().slice(0, 180),
          })
        }
      })
    }
  }

  return findings.sort(compareFindings)
}

function* walkTarget(targetPath) {
  if (!existsSync(targetPath)) return
  const stats = statSync(targetPath)

  if (stats.isDirectory()) {
    yield* walkFiles(targetPath)
  } else if (stats.isFile()) {
    yield targetPath
  }
}

function* walkFiles(directory) {
  for (const entry of readdirSync(directory).sort()) {
    const filePath = path.join(directory, entry)
    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      yield* walkFiles(filePath)
    } else if (stats.isFile()) {
      yield filePath
    }
  }
}

function compareFindings(a, b) {
  return a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column
}

function shouldScanFile(relativePath) {
  const normalized = `/${relativePath}`
  if (EXCLUDED_PATH_PARTS.some((part) => normalized.includes(part))) return false
  if (EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath))) return false
  return /\.(ts|tsx|js|jsx)$/u.test(relativePath)
}

function printScanFindings(findings) {
  const activeFindings = findings.filter((finding) => !finding.allowed)
  const allowedFindings = findings.length - activeFindings.length
  const activeFiles = new Set(activeFindings.map((finding) => finding.path)).size
  const allowedFiles = new Set(
    findings.filter((finding) => finding.allowed).map((finding) => finding.path)
  ).size

  console.log(
    `vietnamese hardcode scan: ${activeFindings.length} active findings in ${activeFiles} files, ${allowedFindings} allowlisted findings in ${allowedFiles} files`
  )

  for (const finding of activeFindings) {
    console.log(`${finding.path}:${finding.line}:${finding.column} ${finding.text}`)
  }

  if (allowedFindings > 0) {
    console.log('allowlisted findings:')
    const grouped = new Map()
    for (const finding of findings.filter((entry) => entry.allowed)) {
      grouped.set(finding.reason, (grouped.get(finding.reason) ?? 0) + 1)
    }
    for (const [reason, count] of grouped) {
      console.log(`  ${count} - ${reason}`)
    }
  }

  return activeFindings.length
}

function printFallbackFindings(findings) {
  console.log(`fallback scan: ${findings.length} disallowed findings`)

  for (const finding of findings) {
    console.log(
      `${finding.path}:${finding.line}:${finding.column} ${finding.message} ${finding.text}`
    )
  }
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/')
}
