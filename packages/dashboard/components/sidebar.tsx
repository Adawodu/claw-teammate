"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Rocket,
  DollarSign,
  Image,
  Brain,
  Puzzle,
  Zap,
  Key,
  ScrollText,
  Settings,
  CreditCard,
  ShieldCheck,
  Shield,
  Mail,
  Menu,
  FileText,
  Users,
} from "lucide-react";
import { LogoIcon } from "@/components/logo";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/deploy", label: "Deploy", icon: Rocket },
  { href: "/costs", label: "Costs", icon: DollarSign },
  { href: "/media", label: "Media", icon: Image },
  { href: "/knowledge", label: "Knowledge", icon: Brain },
  { href: "/privacy", label: "Privacy", icon: Shield },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/plugins", label: "Plugins", icon: Puzzle },
  { href: "/skills", label: "Skills", icon: Zap },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

const adminItems = [
  { href: "/admin/pricing", label: "Pricing", icon: ShieldCheck },
  { href: "/admin/cms", label: "CMS", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isAdminUser = useQuery(api.admin.isAdmin, {});

  return (
    <>
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold"
          onClick={onNavigate}
        >
          <LogoIcon size={20} />
          <span>DynoClaw</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {isAdminUser && (
          <>
            <div className="my-2 border-t" />
            <p className="px-3 py-1 text-xs font-medium text-muted-foreground">
              Admin
            </p>
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t p-4">
        <UserButton
          userProfileProps={{
            additionalOAuthScopes: {
              google: ["https://www.googleapis.com/auth/cloud-platform"],
            },
          }}
        />
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 flex-col border-r bg-card md:flex">
      <NavContent />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-14 items-center border-b px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="mr-2 p-0">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent>
          <div className="flex h-full flex-col">
            <NavContent onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <LogoIcon size={20} />
        <span>DynoClaw</span>
      </Link>
    </div>
  );
}
