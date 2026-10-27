export function getErrorMessage(error: unknown, fallback = 'Erro inesperado'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}
