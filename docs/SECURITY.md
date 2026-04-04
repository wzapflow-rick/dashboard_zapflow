# 🔐 Segurança - Auditoria OWASP Top 10

> Este documento detalha a auditoria de segurança realizada no ZapFlow seguindo as diretrizes do OWASP Top 10 (2021).

---

## 📊 Resumo da Auditoria

| Vulnerabilidade OWASP | Severidade | Status |
|----------------------|------------|--------|
| A01: Broken Access Control | 🔴 Crítica | ✅ Corrigido |
| A02: Cryptographic Failures | 🔴 Crítica | ✅ Parcial |
| A03: Injection | 🟠 Alta | ✅ Corrigido |
| A04: Insecure Design | 🟠 Alta | ✅ Corrigido |
| A05: Security Misconfiguration | 🟡 Média | ✅ Corrigido |
| A06: Vulnerable Components | 🟡 Média | ✅ Mitigado |
| A07: Auth Failures | 🟡 Média | ✅ Corrigido |
| A08: Software & Data Integrity | 🟡 Média | ✅ Implementado |
| A09: Logging Failures | 🟡 Média | ✅ Corrigido |
| A10: SSRF | 🟢 Baixa | ✅ Mitigado |

---

## A01: Broken Access Control ✅

### Problema Identificado
Um restaurante poderia manipular IDs na URL para acessar/editar pedidos de outras empresas.

### Correções Implementadas

```typescript
// app/actions/orders.ts:173-179
const orderData = await orderRes.json();

if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
    logger.securityAccessDenied(user.empresaId, `order:${id}`, 'UPDATE_STATUS');
    throw new Error('Acesso negado: Pedido não pertence a esta empresa');
}
```

```typescript
// app/actions/driver-auth.ts:156-167
const checkRes = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`);
const order = await checkRes.json();

if (!order || Number(order.entregador_id) !== Number(session.driverId)) {
    throw new Error('Acesso negado: Pedido não pertence a este entregador');
}
```

---

## A02: Cryptographic Failures ⚠️

### Problemas Identificados

1. **`.env` exposto com credenciais em texto** — CRÍTICO
2. **JWT_SECRET com fallback inseguro** em produção
3. **Senha de entregador = telefone** — vulnerabilidade已知

###Correções Aplicadas

```typescript
// lib/session.ts
function getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable is required in production');
        }
        console.warn('⚠️ Using fallback JWT_SECRET for development only!');
        return 'fallback-secret-for-dev-only';
    }
    return secret;
}
```

### ⚠️ Ação Necessária

| Problema | Severidade | Ação |
|----------|------------|------|
| Credenciais no .env | 🔴 CRÍTICO | Regenerar todas as chaves imediatamente |
| JWT_SECRET fallback | 🔴 CRÍTICO | Definir variável com 32+ caracteres |
| Senha = telefone | 🟠 ALTO | Implementar senha própria para drivers |

---

## A03: Injection ✅

### Correções Implementadas

**Sanitização Reforçada** (`lib/validations.ts`):

```typescript
const DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:\s*text\/html/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
];

export function sanitizeString(str: string): string {
    let sanitized = str
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
    
    for (const pattern of DANGEROUS_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
    }
    return sanitized;
}
```

**Validação de ID** (`app/api/track/[orderId]/route.ts`):

```typescript
if (!orderId || typeof orderId !== 'string' || !/^\d+$/.test(orderId)) {
    return NextResponse.json({ error: 'ID do pedido inválido' }, { status: 400 });
}
const sanitizedOrderId = orderId.replace(/[^0-9]/g, '');
```

---

## A04: Insecure Design ✅

### Correções Implementadas

**Cupons - Prevenção de valores negativos** (`app/actions/coupons.ts`):

```typescript
const maxDescontoPermitido = valorPedido - 100;
const descontoFinal = Math.min(desconto, maxDescontoPermitido);
return { ...desconto: Math.max(descontoFinal, 0) };
```

**Taxas de Entrega - Validações** (`app/actions/delivery.ts`):

```typescript
// Coordenadas inválidas
if (destination.lat < -90 || destination.lat > 90 || destination.lng < -180 || destination.lng > 180) {
    return { success: false, error: 'Coordenadas inválidas' };
}

// Valores negativos
if (config.valor_por_km < 0 || config.taxa_entrega_fixa < 0) {
    return { success: false, error: 'Configuração de entrega inválida' };
}

// Distância inválida
if (distance.distance_km <= 0 || distance.distance_km > 500) {
    return { success: false, error: 'Distância inválida calculada' };
}

// Taxa nunca negativa
taxa = Math.max(0, taxa);
```

---

## A09: Security Logging & Monitoring ✅

### Sistema Implementado (`lib/logger.ts`)

```typescript
export const logger = {
    securityLoginFailure: (email: string, reason: string, ip?: string) => {
        writeToLog('security', 'LOGIN_FAILURE', { 
            email: maskEmail(email), 
            reason, 
            ip,
            attemptTime: new Date().toISOString() 
        });
    },
    
    securityLoginSuccess: (email: string, userId: string | number, ip?: string) => {
        writeToLog('security', 'LOGIN_SUCCESS', { 
            email: maskEmail(email), 
            userId, 
            ip 
        });
    },
    
    securityAccessDenied: (userId: string | number, resource: string, action: string, ip?: string) => {
        writeToLog('security', 'ACCESS_DENIED', { userId, resource, action });
    },
};
```

### Logs de Auditoria

- Tentativas de login (sucesso/falha)
- Ações administrativas críticas
- Acessos negados (Broken Access Control)
- Dados sensíveis mascarados (LGPD)

---

## A06: Vulnerable Components ✅

### Scripts Adicionados (`package.json`)

```json
{
    "scripts": {
        "security:audit": "npm audit --production --audit-level=moderate",
        "security:deps": "npm outdated --depth=0",
        "security:scan": "npm audit --json | grep -E '(vulnerability|critical|high)' | head -20"
    }
}
```

### Executar Auditoria

```bash
npm run security:audit
npm run security:deps
```

---

## 🛡️ Medidas de Segurança Ativas

| Medida | Implementação |
|--------|---------------|
| Rate Limiting | 5 tentativas/15min no login |
| Cookies HttpOnly | Session com `httpOnly: true` |
| SameSite Strict | Prevenção de CSRF |
| HTTPS Force | Middleware redireciona HTTP → HTTPS |
| Sanitização | Zod + padrões perigosos |
| Mascaramento | E-mails em logs |

---

## 📝 Checklist de Segurança

- [x] Broken Access Control corrigido
- [x] Sanitização de inputs implementada
- [x] Sistema de logging de segurança
- [x] Rate limiting ativo
- [ ] JWT_SECRET forte configurado (requer ação)
- [ ] Credenciais rotacionadas (requer ação)
- [ ] Senha própria para drivers (requer ação)
- [ ] Auditoria de dependências automatizada

---

## 📞 Vulnerabilidades Comunicadas

Para reportar vulnerabilidades de segurança, abra uma **Issue** com tag `security`.