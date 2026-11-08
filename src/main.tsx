import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';
import { ThemeProvider } from '@/components/app-shell/theme-provider';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
