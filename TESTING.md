# Test Suite for ZapFlow SaaS Dashboard

This document outlines the testing strategy and test cases for the ZapFlow SaaS Dashboard project.

## Testing Strategy

We use Jest and React Testing Library for unit and integration tests. The testing approach includes:

1. **Unit Tests** - Testing individual functions and components in isolation
2. **Integration Tests** - Testing how components work together
3. **End-to-End Tests** - Testing complete user flows (using Playwright, configured separately)

## Setup

Install testing dependencies:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest
```

Configure Jest by creating `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1'
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)'
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/out/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## Test Categories

### 1. Action Functions (Server Actions)
Test all server actions in `/app/actions/`:
- Authentication flows
- Loyalty program operations
- Coupon validation
- Order creation
- Payment processing
- Delivery calculations
- Menu item retrieval

### 2. Client Components
Test components in `/components/`:
- Cart functionality
- Menu filtering and product selection
- Loyalty management interface
- Customer forms
- Payment forms
- UI interactions

### 3. Library Functions
Test utility functions in `/lib/`:
- Validation schemas
- Utility helpers
- Session management
- Audit logging

### 4. Integration Tests
Test complete user flows:
- Product selection → Cart → Checkout → Payment
- Loyalty points earning and redemption
- Coupon application
- Delivery fee calculation
- Order completion and confirmation

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/components/cart/cart.spec.tsx
```

## Test File Conventions

- Test files are placed alongside the source files they test
- Naming convention: `[filename].spec.tsx` or `[filename].test.tsx`
- Test suites describe the unit being tested
- Test cases describe specific behaviors or scenarios
- Use descriptive test names that explain the expected behavior

## Mocking

We mock:
- External APIs (NocoDB, MercadoPago, etc.)
- Browser APIs (localStorage, sessionStorage, etc.)
- Next.js navigation and routing
- Environment variables

Example mock setup in `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      query: {}
    };
  },
  usePathname() {
    return '';
  },
  useSearchParams() {
    return new URLSearchParams();
  }
}));

// Mock NextImage
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => (
    <img {...props} data-testid="NextImage" />
  )
}));
```

## Continuous Integration

Tests are run automatically on every pull request to ensure code quality and prevent regressions.

## Contributing

When adding new features:
1. Write tests for new functionality before implementing (TDD approach)
2. Ensure all existing tests still pass
3. Update documentation if needed
4. Maintain or improve test coverage

## License

This project is licensed under the MIT License.