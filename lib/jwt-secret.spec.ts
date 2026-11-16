const ORIGINAL_ENV = { ...process.env };

function loadGetJWTSecret() {
  let getJWTSecret!: () => string;
  jest.isolateModules(() => {
    ({ getJWTSecret } = require('./jwt-secret'));
  });
  return getJWTSecret;
}

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe('getJWTSecret', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses JWT_SECRET when configured', () => {
    setEnv({ JWT_SECRET: 'a'.repeat(40), NODE_ENV: 'production', NEXT_PHASE: undefined });
    expect(loadGetJWTSecret()()).toBe('a'.repeat(40));
  });

  it('fails closed in production runtime without JWT_SECRET', () => {
    setEnv({ JWT_SECRET: undefined, NODE_ENV: 'production', NEXT_PHASE: undefined });
    expect(() => loadGetJWTSecret()()).toThrow('JWT_SECRET');
  });

  it('never falls back to the old hardcoded secret during build', () => {
    setEnv({ JWT_SECRET: undefined, NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' });
    const secret = loadGetJWTSecret()();
    expect(secret).not.toContain('fallback-secret');
    expect(secret).toHaveLength(64);
  });

  it('uses a random per-process secret in development', () => {
    setEnv({ JWT_SECRET: undefined, NODE_ENV: 'development', NEXT_PHASE: undefined });
    const first = loadGetJWTSecret()();
    const second = loadGetJWTSecret()();
    expect(first).not.toBe(second);
  });
});
