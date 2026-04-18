import { parseCurrency, cn } from './utils';

describe('parseCurrency', () => {
  it('should convert Brazilian currency format to number', () => {
    expect(parseCurrency('1.250,50')).toBe(1250.5);
    expect(parseCurrency('2.000,00')).toBe(2000);
    expect(parseCurrency('0,99')).toBe(0.99);
  });

  it('should handle standard JS/US currency format', () => {
    expect(parseCurrency('1250.50')).toBe(1250.5);
    expect(parseCurrency('2000.00')).toBe(2000);
    expect(parseCurrency('0.99')).toBe(0.99);
  });

  it('should return 0 for invalid or empty inputs', () => {
    expect(parseCurrency('')).toBe(0);
    expect(parseCurrency(null)).toBe(0);
    expect(parseCurrency(undefined as any)).toBe(0);
    expect(parseCurrency('abc')).toBe(0);
    expect(parseCurrency('abc,def')).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(parseCurrency('-1.250,50')).toBe(-1250.5);
    expect(parseCurrency('-0,99')).toBe(-0.99);
  });
});

describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
    expect(cn('class1', false, 'class2')).toBe('class1 class2');
    expect(cn('class1', undefined, 'class2')).toBe('class1 class2');
    expect(cn(null, 'class1')).toBe('class1');
    expect(cn()).toBe('');
  });
});