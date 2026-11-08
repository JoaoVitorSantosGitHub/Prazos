import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper padrão do shadcn/ui: junta classes condicionais (clsx) e resolve
// conflito entre classes Tailwind que fazem a mesma coisa (twMerge) -- ex:
// cn('px-2', condicao && 'px-4') sempre fica só com 'px-4' no final, nunca
// os dois brigando.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
