# Contributing to Agent Dashboard

Thank you for your interest in contributing! This project follows Test-Driven Development (TDD) practices to ensure code quality and reliability.

## TDD Workflow

We follow the Red-Green-Refactor cycle:

### 1. 🔴 Red: Write a Failing Test

Before writing any code, write a test that describes the desired behavior:

```bash
npm run test:watch
```

Create a new test file or add to an existing one:

```typescript
// src/components/__tests__/MyComponent.test.tsx
import { describe, it, expect } from 'vitest'

describe('MyComponent', () => {
  it('should render with the correct text', () => {
    const result = myFunction('input')
    expect(result).toBe('expected output')
  })
})
```

Run the test and **verify it fails** for the right reason.

### 2. 🟢 Green: Write Minimal Code to Pass

Write just enough code to make the test pass:

```typescript
// src/components/MyComponent.tsx
export function myFunction(input: string): string {
  return 'expected output' // Minimal implementation
}
```

Run the test again and verify it passes:

```bash
npm test
```

### 3. ♻️ Refactor: Improve While Keeping Tests Green

Now improve the code quality while keeping tests passing:

- Remove duplication
- Improve naming
- Optimize performance
- Add edge case handling

Run tests after each refactor to ensure nothing broke:

```bash
npm run test:watch
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run tests once |
| `pnpm test:watch` | Run tests in watch mode (TDD mode) |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:e2e:smoke` | Run fast Playwright smoke checks used in pre-push |
| `pnpm test:e2e` | Run full Playwright E2E suite (CI-required for merge) |
| `pnpm lint` | Check code quality with ESLint |
| `pnpm lint:fix` | Auto-fix linting issues |
| `pnpm typecheck` | Validate TypeScript types |
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm hooks:install` | Install repo-managed git hooks |

## Test Organization

```
src/
├── components/
│   ├── Button.tsx
│   └── __tests__/
│       └── Button.test.tsx
├── lib/
│   ├── utils.ts
│   └── __tests__/
│       └── utils.test.ts
└── routes/
    ├── index.tsx
    └── __tests__/
        └── index.test.tsx
```

## Coverage Requirements

We maintain 80% coverage thresholds:

- **Statements:** 80%
- **Branches:** 80%
- **Functions:** 80%
- **Lines:** 80%

Check coverage:

```bash
npm run test:coverage
```

View the HTML report:

```bash
open coverage/index.html
```

## Writing Good Tests

### ✅ Do

- **Test behavior, not implementation**
- **Use descriptive test names** that explain what is being tested
- **Follow Arrange-Act-Assert pattern**
- **Test edge cases** (empty inputs, null, undefined)
- **Keep tests simple** and focused on one thing

### ❌ Don't

- **Don't test implementation details** (internal state, private methods)
- **Don't write tests that depend on each other**
- **Don't mock everything** - integration tests are valuable
- **Don't skip the Red phase** - always see your test fail first

## Example TDD Session

Let's add a utility function that formats task priorities:

### 1. Write the test (Red)

```typescript
// src/lib/__tests__/formatters.test.ts
import { describe, it, expect } from 'vitest'
import { formatPriority } from '../formatters'

describe('formatPriority', () => {
  it('should format high priority with emoji', () => {
    expect(formatPriority('high')).toBe('🔴 High')
  })

  it('should format normal priority with emoji', () => {
    expect(formatPriority('normal')).toBe('🟡 Normal')
  })

  it('should format low priority with emoji', () => {
    expect(formatPriority('low')).toBe('🟢 Low')
  })

  it('should handle unknown priorities', () => {
    expect(formatPriority('unknown')).toBe('⚪ Unknown')
  })
})
```

Run `npm run test:watch` - tests should **fail**.

### 2. Write minimal code (Green)

```typescript
// src/lib/formatters.ts
export function formatPriority(priority: string): string {
  const emojis = {
    high: '🔴',
    normal: '🟡',
    low: '🟢',
  }

  const emoji = emojis[priority as keyof typeof emojis] || '⚪'
  const label = priority.charAt(0).toUpperCase() + priority.slice(1)

  return `${emoji} ${label}`
}
```

Tests should now **pass**.

### 3. Refactor (Clean)

```typescript
// src/lib/formatters.ts
type Priority = 'high' | 'normal' | 'low'

const PRIORITY_EMOJIS: Record<Priority, string> = {
  high: '🔴',
  normal: '🟡',
  low: '🟢',
}

const DEFAULT_EMOJI = '⚪'

export function formatPriority(priority: string): string {
  const emoji = PRIORITY_EMOJIS[priority as Priority] ?? DEFAULT_EMOJI
  const label = priority.charAt(0).toUpperCase() + priority.slice(1)

  return `${emoji} ${label}`
}
```

Tests should still **pass** after refactoring.

## Pre-push Gate & Bypass Policy

Install hooks after cloning:

```bash
pnpm hooks:install
```

The pre-push hook runs:

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm test:e2e:smoke`

Emergency override:

- `SKIP_E2E_SMOKE=1 git push` may be used only for urgent unblock situations.
- Avoid `git push --no-verify`.
- If either override is used, explicitly note it in the PR description with a reason.

CI still runs the full E2E suite (`pnpm test:e2e`) and it remains required for merge.

## Pre-Commit Checklist

Before committing code:

- [ ] All tests pass (`npm test`)
- [ ] Code is linted (`npm run lint`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Coverage thresholds met (`npm run test:coverage`)
- [ ] Code is refactored and clean
- [ ] Meaningful commit message

## CI/CD Pipeline

Our GitHub Actions workflow runs:

1. **Lint** - ESLint checks
2. **Type Check** - TypeScript validation
3. **Test** - All tests with coverage
4. **Build** - Production build

All checks must pass before merging.

## Questions?

- Check the [README](./README.md) for setup instructions
- Review existing tests for examples
- Ask in GitHub issues or discussions

Happy coding! 🚀
