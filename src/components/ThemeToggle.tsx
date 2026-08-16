"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // Evita mismatch de hidratación — next-themes solo conoce el tema real en el cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
        className
      )}
    >
      {mounted && isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
      {mounted ? (isDark ? "Tema claro" : "Tema oscuro") : "Tema"}
    </button>
  );
}
