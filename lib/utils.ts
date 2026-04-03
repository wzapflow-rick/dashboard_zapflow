import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte uma string de preço/moeda para número (float),
 * lidando com formatos brasileiros (1.250,50) e padrão JS (1250.50).
 */
export function parseCurrency(val: string | null | undefined): number {
  if (!val) return 0;
  const str = String(val).trim();
  if (!str) return 0;

  let result: number;
  // Se tiver vírgula, tratamos como formato BR: 
  // remover pontos (separadores de milhar) e trocar vírgula por ponto (decimal)
  if (str.includes(',')) {
    result = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  // Se não tiver vírgula, tratamos como formato padrão JS/US
  else {
    result = parseFloat(str);
  }

  return isNaN(result) || !isFinite(result) ? 0 : result;
}
