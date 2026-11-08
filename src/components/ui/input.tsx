import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Mensagem de erro — quando presente, a borda fica vermelha e o texto aparece embaixo. */
  error?: string;
}

// Mesmo campo do app Fiscal (components/ui/input.tsx).
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60',
            error
              ? 'border-destructive focus-visible:ring-destructive/20'
              : 'border-input focus-visible:border-primary focus-visible:ring-primary/20',
            className
          )}
          aria-invalid={!!error || undefined}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
