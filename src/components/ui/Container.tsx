import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ContainerProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

export function Container({
  as: Tag = "div",
  className,
  children,
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1200px] px-4 md:px-8", className)}>
      {children}
    </Tag>
  );
}
