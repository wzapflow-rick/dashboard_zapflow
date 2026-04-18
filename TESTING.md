# Test Suite for ZapFlow SaaS Dashboard

This document outlines the testing strategy, test cases, and coverage for the ZapFlow SaaS Dashboard project.

## Testing Strategy

We use Jest and React Testing Library for unit and integration tests. The testing approach includes:

1. **Unit Tests** - Testing individual functions and components in isolation
2. **Integration Tests** - Testing how components work together
3. **End-to-End Tests** - Testing complete user flows (using Playwright, configured separately)

## Setup

Install testing dependencies:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest jest-environment-jsdom
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Files and Coverage

### 1. Utility Functions (`lib/utils.spec.ts`)

Tests for utility functions in `/lib/utils.ts`:

- **parseCurrency**: Converting currency strings to numbers
  - Brazilian format (1.250,50)
  - Standard format (1250.50)
  - Invalid inputs handling
  - Negative numbers

- **cn**: Class name merging utility
  - Basic merging
  - Filtering falsy values

### 2. Validation Schemas (`lib/validations.spec.ts`)

Tests for Zod validation schemas in `/lib/validations.ts`:

- **LoginSchema**: Email and password validation
- **ProductSchema**: Product data validation with sanitization
- **CategorySchema**: Category name validation
- **CustomerSchema**: Customer phone and name validation
- **CouponSchema**: Coupon code normalization and validation
- **LoyaltyConfigSchema**: Loyalty program configuration
- **LoyaltyRedeemSchema**: Points redemption validation
- **sanitizeString**: XSS prevention and HTML sanitization
- **sanitizeHtml**: HTML entity escaping

### 3. Loyalty Actions (`app/actions/loyalty.spec.ts`)

Tests for loyalty server actions in `/app/actions/loyalty.ts`:

- **getLoyaltyConfig**: Fetching loyalty program configuration
- **getLoyaltyStats**: Fetching loyalty statistics
- **saveLoyaltyConfig**: Saving loyalty configuration

### 4. Cart Logic (`components/menu/cart-context.spec.ts`)

Tests for cart calculations and state management:

- Subtotal calculation
- Coupon discount application (percentual and fixed)
- Total calculation with delivery fee
- Loyalty points calculation
- Item quantity updates
- Item removal
- Cart clearing

### 5. Coupon Actions (`app/actions/coupons.spec.ts`)

Tests for coupon server actions in `/app/actions/coupons.ts`:

- **getCoupons**: Fetching all coupons
- **validateCoupon**: Validating coupon for order
- **upsertCoupon**: Creating/updating coupon
- **deleteCoupon**: Deleting coupon

### 6. Products and Insumos (`app/actions/products-insumos.spec.ts`)

Tests for products and insumos actions:

- **getProducts**: Fetching products
- **upsertProduct**: Creating/updating products
- **getInsumos**: Fetching inventory items
- **upsertInsumo**: Creating/updating inventory items

## Test Results

Current test coverage:

```
Test Suites: 6 passed, 6 total
Tests:       61 passed, 61 total
```

All tests are passing successfully.

## Mock Setup (`jest.setup.tsx`)

The test environment includes mocks for:

- Next.js navigation (useRouter, usePathname, useSearchParams)
- Next.js Image component
- Next.js dynamic imports
- Lucide React icons
- Sonner toast notifications
- Next.js cache (revalidatePath, revalidateTag)
- Session server (getMe, requireAdmin)
- Validations (LoyaltyConfigSchema, CouponSchema, etc.)
- Audit logging (logAction)
- Global fetch, Request, Response, Headers, TextEncoder, TextDecoder

## Jest Configuration (`jest.config.js`)

Key configuration options:
- Preset: ts-jest
- Test environment: jsdom
- Module name mapping for @/ aliases
- Coverage collection from app, components, lib directories

## CI/CD Integration

Tests are run automatically on every pull request to ensure code quality and prevent regressions.

## Adding New Tests

When adding new features:

1. Create a test file alongside the source file
2. Use descriptive test names
3. Test both success and failure cases
4. Ensure all existing tests still pass
5. Maintain or improve test coverage

Example:

```typescript
describe('ModuleName', () => {
  it('should do something specific', () => {
    // Arrange
    const input = ...;
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe(expectedValue);
  });
});
```