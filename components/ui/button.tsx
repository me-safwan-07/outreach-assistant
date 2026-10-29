import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-focus)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] gap-1.5",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--text)] text-[var(--bg)] border border-[var(--text)] hover:bg-[#d4d1cb] hover:border-[#d4d1cb]",
        destructive:
          "bg-transparent text-[var(--error)] border border-[rgba(248,113,113,0.3)] hover:bg-[rgba(248,113,113,0.08)]",
        outline:
          "bg-transparent text-[var(--text)] border border-[var(--border-2)] hover:bg-[var(--bg-2)] hover:border-[var(--border-focus)]",
        secondary:
          "bg-[var(--bg-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-3)] hover:border-[var(--border-2)]",
        ghost:
          "bg-transparent text-[var(--text-muted)] border border-transparent hover:bg-[var(--bg-2)] hover:text-[var(--text)]",
        gradient:
          "bg-[var(--text)] text-[var(--bg)] border border-[var(--text)] hover:bg-[#d4d1cb]",
        link: "text-[var(--text-muted)] underline-offset-4 hover:underline hover:text-[var(--text)]",
      },
      size: {
        default: "h-9 px-3.5 py-2 rounded-[var(--radius-sm)]",
        sm: "h-7 px-2.5 text-xs rounded-[var(--radius-sm)]",
        lg: "h-10 px-5 text-sm font-semibold rounded-[var(--radius-sm)]",
        icon: "h-8 w-8 rounded-[var(--radius-sm)]",
        iconSm: "h-6 w-6 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
