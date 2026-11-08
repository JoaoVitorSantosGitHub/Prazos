import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Mesmas variantes e tamanhos do app Fiscal (components/ui/button.tsx) --
// não inventar variante nova fora dessa lista.
const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-active',
        // outline usa o efeito "fill sweep" via ::after -- ver globals.css (.btn-outline-sweep)
        outline: 'btn-outline-sweep border-2 border-border bg-transparent text-foreground',
        ghost: 'bg-transparent text-foreground hover:bg-secondary active:bg-secondary-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-active',
        link: 'h-auto bg-transparent p-0 text-link underline-offset-4 hover:text-link-hover hover:underline active:text-link-active',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-4 py-2',
        lg: 'h-10 px-6 text-base',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Estado de carregamento: troca o conteúdo por um spinner sem mudar a largura do botão. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>{children}</Slot>;
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          </span>
        )}
        {/* o texto fica num <span> acima do ::after do outline (fill sweep) */}
        <span className={cn('relative z-[1] inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
