/**
 * SMS Templates Index
 * Re-exports all message templates for easy access
 */
import {
  generateWelcomeMessage,
  WELCOME_TEMPLATE_NAME,
  type WelcomeTemplateParams,
} from './welcome'

import {
  generateMissingDocsMessage,
  MISSING_DOCS_TEMPLATE_NAME,
  type MissingDocsTemplateParams,
} from './missing-docs'

import {
  generateBlurryResendMessage,
  BLURRY_RESEND_TEMPLATE_NAME,
  type BlurryResendTemplateParams,
} from './blurry-resend'

import {
  generateCompleteMessage,
  COMPLETE_TEMPLATE_NAME,
  type CompleteTemplateParams,
} from './complete'

import {
  generateScheduleCMessage,
  SCHEDULE_C_TEMPLATE_NAME,
  type ScheduleCTemplateParams,
} from './schedule-c'

import {
  generateScheduleEMessage,
  SCHEDULE_E_TEMPLATE_NAME,
  type ScheduleETemplateParams,
} from './schedule-e'

import {
  generateMissedCallTextbackMessage,
  MISSED_CALL_TEXTBACK_TEMPLATE_NAME,
  type MissedCallTextbackParams,
} from './missed-call-textback'

// Re-export everything
export {
  generateWelcomeMessage,
  WELCOME_TEMPLATE_NAME,
  generateMissingDocsMessage,
  MISSING_DOCS_TEMPLATE_NAME,
  generateBlurryResendMessage,
  BLURRY_RESEND_TEMPLATE_NAME,
  generateCompleteMessage,
  COMPLETE_TEMPLATE_NAME,
  generateScheduleCMessage,
  SCHEDULE_C_TEMPLATE_NAME,
  generateScheduleEMessage,
  SCHEDULE_E_TEMPLATE_NAME,
  generateMissedCallTextbackMessage,
  MISSED_CALL_TEXTBACK_TEMPLATE_NAME,
}

export type {
  WelcomeTemplateParams,
  MissingDocsTemplateParams,
  BlurryResendTemplateParams,
  CompleteTemplateParams,
  ScheduleCTemplateParams,
  ScheduleETemplateParams,
  MissedCallTextbackParams,
}

// Template name union type
export type TemplateName =
  | typeof WELCOME_TEMPLATE_NAME
  | typeof MISSING_DOCS_TEMPLATE_NAME
  | typeof BLURRY_RESEND_TEMPLATE_NAME
  | typeof COMPLETE_TEMPLATE_NAME
  | typeof SCHEDULE_C_TEMPLATE_NAME
  | typeof SCHEDULE_E_TEMPLATE_NAME
  | typeof MISSED_CALL_TEXTBACK_TEMPLATE_NAME

// Language type
export type SmsLanguage = 'VI' | 'EN'
