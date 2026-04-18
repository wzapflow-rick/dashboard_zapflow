import { 
  LoginSchema, 
  ProductSchema, 
  CategorySchema, 
  CustomerSchema, 
  CouponSchema,
  LoyaltyConfigSchema,
  LoyaltyRedeemSchema,
  sanitizeString,
  sanitizeHtml
} from './validations';

describe('Validation Schemas', () => {
  describe('LoginSchema', () => {
    it('should validate valid login data', () => {
      const result = LoginSchema.safeParse({ email: 'test@test.com', password: '123456' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = LoginSchema.safeParse({ email: 'invalid', password: '123456' });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = LoginSchema.safeParse({ email: 'test@test.com', password: '123' });
      expect(result.success).toBe(false);
    });
  });

  describe('ProductSchema', () => {
    it('should validate valid product data', () => {
      const result = ProductSchema.safeParse({
        nome: 'Pizza Margherita',
        preco: 49.90,
        categoria_id: 1
      });
      expect(result.success).toBe(true);
    });

    it('should reject short product name', () => {
      const result = ProductSchema.safeParse({ nome: 'AB', preco: 10 });
      expect(result.success).toBe(false);
    });

    it('should reject negative price', () => {
      const result = ProductSchema.safeParse({ nome: 'Pizza', preco: -10 });
      expect(result.success).toBe(false);
    });

    it('should sanitize product name', () => {
      const result = ProductSchema.safeParse({ nome: '<script>alert(1)</script>Pizza' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nome).not.toContain('<script>');
      }
    });
  });

  describe('CategorySchema', () => {
    it('should validate valid category', () => {
      const result = CategorySchema.safeParse({ nome: 'Pizzas', ordem: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject short category name', () => {
      const result = CategorySchema.safeParse({ nome: 'A' });
      expect(result.success).toBe(false);
    });
  });

  describe('CustomerSchema', () => {
    it('should validate valid customer', () => {
      const result = CustomerSchema.safeParse({
        nome: 'João Silva',
        telefone: '11999999999'
      });
      expect(result.success).toBe(true);
    });

    it('should reject short name', () => {
      const result = CustomerSchema.safeParse({ nome: 'A', telefone: '11999999999' });
      expect(result.success).toBe(false);
    });

    it('should reject short phone', () => {
      const result = CustomerSchema.safeParse({ nome: 'João', telefone: '123' });
      expect(result.success).toBe(false);
    });
  });

  describe('CouponSchema', () => {
    it('should validate valid coupon', () => {
      const result = CouponSchema.safeParse({
        codigo: 'PROMO20',
        tipo: 'percentual',
        valor: 20
      });
      expect(result.success).toBe(true);
    });

    it('should normalize coupon code to uppercase', () => {
      const result = CouponSchema.safeParse({ codigo: 'promo20', tipo: 'valor_fixo', valor: 10 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codigo).toBe('PROMO20');
      }
    });

    it('should reject negative value', () => {
      const result = CouponSchema.safeParse({ codigo: 'PROMO', tipo: 'valor_fixo', valor: -10 });
      expect(result.success).toBe(false);
    });
  });

  describe('LoyaltyConfigSchema', () => {
    it('should validate valid config', () => {
      const result = LoyaltyConfigSchema.safeParse({
        pontos_por_real: 1,
        valor_ponto: 0.10,
        pontos_para_desconto: 100,
        desconto_tipo: 'valor_fixo',
        desconto_valor: 10,
        ativo: true
      });
      expect(result.success).toBe(true);
    });

    it('should reject zero pontos_para_desconto', () => {
      const result = LoyaltyConfigSchema.safeParse({
        pontos_para_desconto: 0
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoyaltyRedeemSchema', () => {
    it('should validate valid redemption', () => {
      const result = LoyaltyRedeemSchema.safeParse({
        cliente_telefone: '11999999999',
        pontos_resgatar: 100
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone', () => {
      const result = LoyaltyRedeemSchema.safeParse({
        cliente_telefone: '123',
        pontos_resgatar: 100
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<b>test</b>')).toBe('test');
    });

    it('should escape special characters', () => {
      expect(sanitizeString('test & "test"')).toContain('&amp;');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeHtml('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
    });
  });
});