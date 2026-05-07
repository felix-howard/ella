/**
 * Built-in template registry. Resolves any historical built-in template version
 * for re-rendering signed agreements (audit / PDF regeneration).
 *
 * Org-level templates (AgreementTemplate model) live in the DB and are resolved
 * separately via `templateId`; this registry only carries built-in seed templates.
 *
 * Extension model: bumping a built-in = copy the file, register here.
 */
import type { AgreementType } from '@ella/db'
import { engagementLetterTemplate } from './template-engagement-letter'
import { templateV1 } from './template-v1'
import { templateV2 } from './template-v2'
import type { NdaTemplate } from './types'

function buildRegistry(templates: NdaTemplate[]): Record<string, NdaTemplate> {
  const registry: Record<string, NdaTemplate> = {}
  for (const template of templates) {
    if (registry[template.version]) {
      throw new Error(`Duplicate agreement template version: ${template.version}`)
    }
    registry[template.version] = template
  }
  return registry
}

const REGISTRY = buildRegistry([templateV1, templateV2, engagementLetterTemplate])

export function getTemplate(version: string): NdaTemplate {
  const template = REGISTRY[version]
  if (!template) {
    throw new Error(`Unknown agreement template version: ${version}`)
  }
  return template
}

/** Current default built-in template. New NDAs are created with v2. */
export const currentTemplate: NdaTemplate = templateV2

/**
 * Default built-in template per AgreementType.
 *
 * NDA defaults to v2 for new agreements. v1 remains resolvable via
 * `getTemplate('v1')` for re-rendering existing signed agreements.
 *
 * Engagement Letter has a built-in editor seed, but create still requires the
 * edited HTML snapshot so unresolved case-specific placeholders can be blocked.
 * Other types require either an org-level templateId or customContentHtml.
 */
export function defaultTemplateForType(type: AgreementType): NdaTemplate | null {
  if (type === 'NDA') return templateV2
  if (type === 'ENGAGEMENT_LETTER') return engagementLetterTemplate
  return null
}
