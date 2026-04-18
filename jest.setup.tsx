import '@testing-library/jest-dom';

const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require('util');
(global as any).TextEncoder = NodeTextEncoder;
(global as any).TextDecoder = NodeTextDecoder;

// Mock global fetch
(global as any).fetch = jest.fn();

// Mock Request and Response for Next.js
global.Request = class Request {
  constructor(input: string | Request, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
    this.body = init?.body;
  }
  url: string = '';
  method: string = 'GET';
  headers: Headers = new Headers();
  body: any = null;
  clone(): Request {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.body
    });
  }
} as any;

global.Response = class Response {
  constructor(body: any, init?: ResponseInit) {
    this.ok = (init?.status || 200) >= 200 && (init?.status || 200) < 300;
    this.status = init?.status || 200;
    this.statusText = init?.statusText || '';
    this.headers = new Headers(init?.headers);
    this.body = body;
  }
  ok: boolean = true;
  status: number = 200;
  statusText: string = '';
  headers: Headers = new Headers();
  body: any;
  json(): Promise<any> {
    return Promise.resolve(this.body);
  }
  text(): Promise<string> {
    return Promise.resolve(JSON.stringify(this.body));
  }
} as any;

global.Headers = class Headers {
  private map: Map<string, string> = new Map();
  constructor(init?: any) {
    if (init) {
      if (typeof init === 'object') {
        Object.entries(init).forEach(([k, v]) => this.set(k, v as string));
      }
    }
  }
  get(name: string): string | null { return this.map.get(name.toLowerCase()) || null; }
  set(name: string, value: string): void { this.map.set(name.toLowerCase(), value); }
  has(name: string): boolean { return this.map.has(name.toLowerCase()); }
  delete(name: string): void { this.map.delete(name.toLowerCase()); }
  append(name: string, value: string): void { this.set(name, value); }
} as any;

// Mock next/cache - only for specific modules that need it
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_noStore: jest.fn()
}), { virtual: true });

// Mock getMe - only for specific modules that need it
jest.mock('@/lib/session-server', () => ({
  getMe: jest.fn()
}), { virtual: true });

// Mock validations - only for specific modules that need it
jest.mock('@/lib/validations', () => ({
  LoyaltyConfigSchema: {
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} })
  },
  LoyaltyRedeemSchema: {
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} })
  },
  User: {}
}), { virtual: true });

// Mock audit - only for specific modules that need it
jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}), { virtual: true });