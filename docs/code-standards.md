# Code Standards

Ella follows unified coding standards across all packages to ensure maintainability and consistency.

## TypeScript Standards

**Language Version:** TypeScript 5.7.3+

**Compiler Strict Mode:**

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Naming Conventions:**

- `camelCase` - Variables, functions, properties
- `PascalCase` - Classes, types, interfaces, components
- `UPPER_SNAKE_CASE` - Constants & environment variables
- `kebab-case` - File names (except components: PascalCase)

**Module System:**

- ES modules (`type: "module"` in package.json)
- Tree-shakeable exports in public APIs

## Package Structure

**Standard Layout:**

```
packages/{name}/
├── src/
│   ├── index.ts          # Public exports
│   ├── generated/        # Auto-generated (Prisma)
│   └── {feature}/
├── package.json          # Workspace exports
├── tsconfig.json         # Extends root config
└── {framework-config}    # Config files (prisma.config.ts, components.json)
```

**package.json Exports:**

```json
{
  "name": "@ella/{name}",
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
}
```

## Database (@ella/db)

**Schema Language:** Prisma (prisma/schema.prisma)

**Naming Convention:**

- Model names: `PascalCase` (e.g., `User`, `Document`)
- Field names: `camelCase` (e.g., `createdAt`, `isActive`)
- Relations: plural for arrays (e.g., `documents: Document[]`)

**Best Practices:**

- Always include `id`, `createdAt`, `updatedAt` fields
- Use `@unique` for lookups, `@db.String` for constraints
- Migrations versioned via `prisma/migrations/`
- Generated client output to `src/generated/` (git-ignored)

**Client Pattern:**

```typescript
// src/client.ts - Singleton pattern for dev safety
import { PrismaClient } from './generated'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
```

## Shared Types & Validation (@ella/shared)

**Zod Schema Patterns:**

```typescript
// Primitive validators
export const emailSchema = z.string().email()
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/)

// Composed validators
export const userSchema = z.object({
  id: z.string().cuid(),
  email: emailSchema,
  phone: phoneSchema.optional(),
})

// Type inference
export type User = z.infer<typeof userSchema>
```

**Export Organization:**

- `/schemas` - Zod validators only
- `/types` - TypeScript types & inferred types
- Default export from index includes all

## UI Components (@ella/ui)

**Component Structure:**

```typescript
// src/components/{name}.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva('base-styles', {
  variants: {
    variant: {
      primary: 'primary-styles',
      secondary: 'secondary-styles',
    },
  },
})

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
)
```

**Styling:**

- Tailwind CSS v4 with utility-first approach
- Component variants via `class-variance-authority`
- Class merging via `cn()` utility (clsx + tailwind-merge)
- Global styles in `src/styles.css`

**shadcn/ui Integration:**

- Components copied from shadcn/ui registry
- Customizations in local codebase
- Config: `components.json`

## Git Workflow & Commits

**Branch Naming:**

```
feature/{description}   # New features
fix/{description}       # Bug fixes
hotfix/{description}    # Urgent fixes
refactor/{description}  # Code restructuring
docs/{description}      # Documentation
chore/{description}     # Maintenance
```

**Commit Format:**

```
[Type] | Description

[Add]      - New feature
[Update]   - Enhancement
[Fix]      - Bug fix
[Remove]   - Code removal
[Refactor] - Restructuring
[Docs]     - Documentation
[Chore]    - Maintenance
```

**Example:**

```
[Add] | Database models for User and Document
[Fix] | Prisma client singleton pattern
[Update] | Enhance pagination schema with cursor support
```

## Testing Standards

**Type Checking:**

```bash
pnpm type-check  # Run tsc across all packages
```

**Database Testing:**

- Use Prisma Studio for manual verification
- Migrations tested before pushing to main

## Environment Variables

**Template:** `.env.example`

- All variables prefixed: `DATABASE_URL`, `API_KEY`, etc.
- Never commit `.env` files
- Load via standard Node.js `process.env`

**Current Variables:**

- `DATABASE_URL` - PostgreSQL connection string
- (More added per feature)

## Documentation Standards

**Code Comments:**

- Explain "why", not "what" (code is self-explanatory)
- JSDoc for exported functions/types:

```typescript
/**
 * Validates email format
 * @param email - Email string to validate
 * @returns Validation result
 */
export const validateEmail = (email: string) => emailSchema.parse(email)
```

**Markdown Documentation:**

- Located in `/docs`
- Keep files under 800 lines of code
- Link related docs via relative paths

## Performance & Optimization

**Database:**

- Index frequently queried fields
- Use Prisma `include`/`select` for query optimization
- Pagination via offset/limit or cursor

**Bundling:**

- Tree-shake unused exports
- Lazy load components in apps layer
- Monitor bundle size via Turbo cache

## CI/CD Standards

**Turbo Pipeline (turbo.json):**

- Caching enabled for reproducible builds
- Tasks ordered by dependencies
- Output files tracked for incremental builds

**Commands:**

```bash
turbo run build          # Build all packages
turbo run type-check    # Type check all
turbo run dev           # Development watch mode
```

## Security Best Practices

1. **No Secrets in Code:**
   - Use `.env.example` for documentation
   - Load sensitive data at runtime

2. **Prisma:**
   - Always use parameterized queries (built-in)
   - Validate input via Zod before DB access

3. **API Responses:**
   - Use `apiResponseSchema` wrapper
   - Never expose internal error details
   - Always sanitize user input

## Dependencies Management

**Version Pinning:**

- Lock file: `pnpm-lock.yaml`
- Update via: `pnpm update`
- Major version bumps reviewed before merge

**Workspace Dependencies:**

- Install from package exports
- Example: `import { prisma } from '@ella/db'`

## Linting & Formatting

**ESLint Configuration** (flat config):

- **Config:** `eslint.config.js` (root)
- **Rule Set:**
  - TypeScript + JavaScript recommended rules
  - React Hooks validation (react-hooks)
  - React Refresh optimization checks
  - Unused variables banned (except `_` prefixed)
  - Consistent type imports required
- **Ignored Paths:** `dist/`, `node_modules/`, `*.gen.ts`, `.claude/skills/`
- **Script:** `pnpm lint:root` (lint root directory), `turbo lint` (all packages)

**Prettier Configuration**:

- **Config:** `.prettierrc`
- **Format:**
  - No semicolons (`"semi": false`)
  - Single quotes (`"singleQuote": true`)
  - Indent: 2 spaces
  - Print width: 100 columns
  - Trailing commas: ES5 style
- **Ignored:** Files listed in `.prettierignore` (node_modules, dist, .turbo, .claude/skills)
- **Scripts:**
  - `pnpm format` - Format all files
  - `pnpm format:check` - Verify formatting

**VS Code Integration:**

- **Plugin:** Prettier (esbenp.prettier-vscode)
- **Format on Save:** Enabled
- **ESLint Fix on Save:** Auto-fix enabled via `source.fixAll.eslint`
- **TypeScript:** Uses workspace tsdk (node_modules/typescript)

**Turbo Pipeline Integration:**

- `lint` task: No dependencies, outputs cached
- Global dependencies: `tsconfig.json`, `eslint.config.js`
- Each package has `lint: "eslint src/"` script

---

**Last Updated:** 2026-01-11
**Phase:** 4 - Tooling
**Standards Version:** 1.1
