/**
 * Clipboard utility with toast feedback.
 * Wraps navigator.clipboard.writeText in try/catch to avoid unhandled
 * "NotAllowedError: Document is not focused" throws when invoked outside
 * a user gesture context.
 */
import { toast } from '../stores/toast-store'
import i18n from './i18n'

interface CopyOptions {
  /** i18n-resolved string or literal shown on success */
  successMsg?: string
  /** i18n-resolved string or literal shown on failure */
  errorMsg?: string
  /** when false, suppress toast output (default true) */
  showToast?: boolean
}

/**
 * Copy text to clipboard with toast feedback. Returns true on success.
 * Always call from within a user gesture (click/keydown) to satisfy
 * browser clipboard permission rules.
 */
export async function copyToClipboard(
  text: string,
  options: CopyOptions = {},
): Promise<boolean> {
  const {
    successMsg = i18n.t('common.linkCopied'),
    errorMsg = i18n.t('common.copyFailed'),
    showToast = true,
  } = options

  if (!window.isSecureContext || !navigator.clipboard) {
    if (showToast) toast.error(errorMsg)
    return false
  }

  try {
    await navigator.clipboard.writeText(text)
    if (showToast) toast.success(successMsg)
    return true
  } catch (err) {
    console.warn('Clipboard write failed:', err)
    if (showToast) toast.error(errorMsg)
    return false
  }
}
