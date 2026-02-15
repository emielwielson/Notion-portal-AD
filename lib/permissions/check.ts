import { normalizeNotionId } from '@/lib/utils/notion-id'
import type { EntityType } from '@/types/database'

export type UserEntity = { entityType: EntityType; entityNotionId: string }

/**
 * Validate that the user can access a project by contact linkage.
 * Application-layer check; RLS enforces at DB level.
 */
export function validateUserCanAccessProject(
  userEntities: UserEntity[],
  projectContactId: string,
  projectContactType: EntityType
): boolean {
  const normProject = normalizeNotionId(projectContactId)
  for (const e of userEntities) {
    if (
      e.entityType === projectContactType &&
      normalizeNotionId(e.entityNotionId) === normProject
    ) {
      return true
    }
  }
  return false
}
