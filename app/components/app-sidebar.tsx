"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Users, Clock, Settings, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, match: ["/", "/campaigns"] },
  { label: "Scheduled", href: "/scheduled", icon: Clock, match: ["/scheduled"] },
  { label: "Contacts", href: "/contacts", icon: Users, match: ["/contacts"] },
  { label: "Settings", href: "/settings", icon: Settings, match: ["/settings"] },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  return match.some((m) =>
    m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`)
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-svh w-60 shrink-0 flex-col border-r">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="bg-primary size-5 rounded-md" aria-hidden />
        <span className="font-display text-lg leading-none tracking-tight">
          clubz
        </span>
      </div>

      <div className="px-3 pt-2">
        <Button asChild className="w-full justify-start gap-2">
          <Link href="/campaigns/new">
            <Plus className="size-4" />
            Create campaign
          </Link>
        </Button>
      </div>

      <nav className="flex flex-col gap-1 px-3 pt-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.match);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn("size-4", active && "text-primary")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
