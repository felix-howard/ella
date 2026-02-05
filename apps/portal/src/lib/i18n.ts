/**
 * Portal i18n configuration
 * Vietnamese-first with English support
 * Uses react-i18next with bundled translations
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import vi from '../locales/vi.json'
import en from '../locales/en.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ella-language',
      caches: ['localStorage'],
    },
  })

export default i18n

// Legacy exports for backward compatibility during migration
// Components should migrate to useTranslation() hook instead
export type Language = 'VI' | 'EN'

export const UI_TEXT = {
  VI: {
    welcome: 'Xin chào',
    taxYear: 'Năm thuế',
    uploadDocs: 'Gửi tài liệu',
    takePhoto: 'Chụp ảnh',
    chooseFromGallery: 'Chọn từ thư viện',
    viewStatus: 'Xem trạng thái',
    uploading: 'Đang tải lên...',
    uploadSuccess: 'Đã tải lên thành công!',
    uploadMore: 'Gửi thêm',
    done: 'Hoàn tất',
    received: 'Đã nhận',
    needResend: 'Cần gửi lại',
    missing: 'Còn thiếu',
    noDocsYet: 'Chưa có tài liệu nào',
    thankYou: 'Cảm ơn bạn!',
    errorLoading: 'Không thể tải dữ liệu',
    errorUploading: 'Không thể tải lên',
    tryAgain: 'Thử lại',
    invalidLink: 'Link không hợp lệ',
    linkExpired: 'Link đã hết hạn',
    contactOffice: 'Vui lòng liên hệ văn phòng thuế',
    selectedFiles: 'file đã chọn',
    upload: 'Tải lên',
    cancel: 'Hủy',
    or: 'hoặc',
    filesUploaded: 'file đã được tải lên',
    blurryReason: 'Ảnh bị mờ, vui lòng gửi lại',
    selectPhotos: 'Chọn ảnh hoặc tài liệu để gửi',
    maxFileSize: 'Tối đa 10MB mỗi file',
    supportedFormats: 'Chấp nhận: JPEG, PNG, PDF',
    documents: 'tài liệu',
    photos: 'ảnh',
    uploadTitle: 'Gửi tài liệu thuế',
    backToHome: 'Quay lại trang chủ',
    removeFile: 'Xóa file',
    processing: 'Đang xử lý...',
    dragDropHere: 'Kéo thả file vào đây',
    clickToBrowse: 'hoặc click để chọn',
    fileTooLarge: 'File quá lớn (tối đa 10MB)',
    invalidFileType: 'Chỉ chấp nhận ảnh (JPEG, PNG) và PDF',
    maxFilesReached: 'Chỉ có thể thêm {count} file nữa',
    docsNeeded: 'Tài liệu cần gửi',
    tapToUpload: 'Nhấn để gửi tài liệu',
    uploadedSuccess: 'Đã gửi thành công!',
    noDocsNeeded: 'Đã đủ tài liệu',
  },
  EN: {
    welcome: 'Hello',
    taxYear: 'Tax Year',
    uploadDocs: 'Upload Documents',
    takePhoto: 'Take Photo',
    chooseFromGallery: 'Choose from Gallery',
    viewStatus: 'View Status',
    uploading: 'Uploading...',
    uploadSuccess: 'Uploaded successfully!',
    uploadMore: 'Upload More',
    done: 'Done',
    received: 'Received',
    needResend: 'Need Resend',
    missing: 'Missing',
    noDocsYet: 'No documents yet',
    thankYou: 'Thank you!',
    errorLoading: 'Unable to load data',
    errorUploading: 'Unable to upload',
    tryAgain: 'Try Again',
    invalidLink: 'Invalid link',
    linkExpired: 'Link expired',
    contactOffice: 'Please contact the tax office',
    selectedFiles: 'files selected',
    upload: 'Upload',
    cancel: 'Cancel',
    or: 'or',
    filesUploaded: 'files uploaded',
    blurryReason: 'Image is blurry, please resend',
    selectPhotos: 'Select photos or documents to send',
    maxFileSize: 'Max 10MB per file',
    supportedFormats: 'Accepted: JPEG, PNG, PDF',
    documents: 'documents',
    photos: 'photos',
    uploadTitle: 'Upload Tax Documents',
    backToHome: 'Back to Home',
    removeFile: 'Remove file',
    processing: 'Processing...',
    dragDropHere: 'Drag and drop files here',
    clickToBrowse: 'or click to browse',
    fileTooLarge: 'File too large (max 10MB)',
    invalidFileType: 'Only images (JPEG, PNG) and PDF accepted',
    maxFilesReached: 'Can only add {count} more files',
    docsNeeded: 'Documents Needed',
    tapToUpload: 'Tap to upload documents',
    uploadedSuccess: 'Upload successful!',
    noDocsNeeded: 'All documents received',
  },
}

/** @deprecated Use useTranslation() hook from react-i18next instead */
export function getText(lang: Language) {
  return UI_TEXT[lang] || UI_TEXT.VI
}
