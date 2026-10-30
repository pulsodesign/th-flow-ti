import { useState } from "react";
import { Eye, EyeOff } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function SenhaInput({
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <input
        type={visivel ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-md border border-border bg-surface px-3 py-2 pr-9 text-[13px] outline-none focus:border-primary",
          className,
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        title={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground fluid hover:text-foreground"
      >
        {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
