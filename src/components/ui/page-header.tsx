import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  size?: "md" | "lg";
};

export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
  descriptionClassName,
  size = "md",
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1
          className={cn(
            "font-semibold tracking-tight",
            size === "lg" ? "text-3xl" : "text-2xl",
            titleClassName
          )}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h1>
        {description ? (
          <p className={cn(size === "lg" ? "mt-3" : "mt-1", "text-sm text-muted-foreground", descriptionClassName)}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
