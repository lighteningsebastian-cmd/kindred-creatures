import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

// Near-square (--radius-md, 4px), NOT a pill. Editorial, not soft-SaaS.
const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-[transform,background-color,border-color,color] " +
  "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-base disabled:pointer-events-none " +
  "disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // Oxblood surface with parchment text; deepens on hover. AA in both themes.
  primary: "bg-btn text-base hover:bg-btn-hover",
  // Outline: strong hairline border + ink text.
  secondary: "border border-line-strong text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-base",
};

// Varsity block CTA label: Archivo 900, uppercase, tracked. For hero/primary CTAs.
const blockLabel = "font-block font-black uppercase tracking-[0.08em]";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the label as a varsity-block CTA (Archivo 900 uppercase, tracked). */
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    block && blockLabel,
    className,
  );

  if (typeof props.href === "string") {
    const { href, ...rest } = props as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...rest } = props as ButtonAsButton;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
