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
import { templateV1 } from './template-v1'
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

const REGISTRY = buildRegistry([templateV1])

export function getTemplate(version: string): NdaTemplate {
  const template = REGISTRY[version]
  if (!template) {
    throw new Error(`Unknown agreement template version: ${version}`)
  }
  return template
}

/** Current default built-in template (legacy NDA flow). */
export const currentTemplate: NdaTemplate = templateV1

/**
 * Default built-in template per AgreementType.
 *
 * Only NDA ships with a built-in v1 today. Other types REQUIRE either an
 * org-level templateId or a customContentHtml at create time — there is no
 * built-in fallback for them. Returns null when no built-in default exists.
 *
 * NOTE: non-NDA agreements still record `templateVersion = 'v1'` on the row
 * so `getTemplate()` resolves a structural template for the PDF generator's
 * legacy `template.render(vars)` path (used only when `customContentHtml`
 * is null — which never happens for non-NDA types per the create-rules).
 * The `template.render()` output for non-NDA rows is therefore unreachable
 * and the recorded version is purely a not-null discipline.
 */
export function defaultTemplateForType(type: AgreementType): NdaTemplate | null {
  return type === 'NDA' ? templateV1 : null
}
