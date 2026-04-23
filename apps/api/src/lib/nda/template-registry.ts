/**
 * Template version registry. Lets callers resolve any historical template
 * version for re-rendering signed NDAs (audit / PDF regeneration).
 */
import { templateV1 } from './template-v1'
import type { NdaTemplate } from './types'

function buildRegistry(templates: NdaTemplate[]): Record<string, NdaTemplate> {
  const registry: Record<string, NdaTemplate> = {}
  for (const template of templates) {
    if (registry[template.version]) {
      throw new Error(`Duplicate NDA template version: ${template.version}`)
    }
    registry[template.version] = template
  }
  return registry
}

const REGISTRY = buildRegistry([templateV1])

export function getTemplate(version: string): NdaTemplate {
  const template = REGISTRY[version]
  if (!template) {
    throw new Error(`Unknown NDA template version: ${version}`)
  }
  return template
}

/** Current default template used for new NDA agreements. */
export const currentTemplate: NdaTemplate = templateV1
