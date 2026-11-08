import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { TEMAS } from '@/lib/temas';

// Cada tema é só um conjunto de variáveis de cor (globals.css), aplicado pelo atributo data-theme na <html>:
// trocar de tema não recarrega nada. O padrão é o Neon.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" themes={TEMAS.map((t) => t.id)} defaultTheme="neon" enableSystem={false} storageKey="jvs-tema">
      {children}
    </NextThemesProvider>
  );
}