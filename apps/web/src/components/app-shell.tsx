"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CreditCard,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ReceiptText,
  Users,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Productos", href: "/productos", icon: Boxes },
  { label: "Ventas", href: "/ventas", icon: ReceiptText },
  { label: "Pagos", href: "/pagos", icon: CreditCard },
  { label: "Estado de cuenta", href: "/estado-cuenta", icon: FileText },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { label: "Usuarios", href: "/usuarios", icon: UserCog },
  { label: "Auditoría", href: "/audit", icon: ClipboardList },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { usuario, loading, logout } = useAuth();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="rounded-md border bg-background px-5 py-4 text-sm text-muted-foreground">
          Validando sesión...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-background md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Cobranza</p>
            <p className="text-xs text-muted-foreground">Gestion operativa</p>
          </div>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted font-medium text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <p className="text-sm font-semibold">Sistema de cobranza</p>
              <p className="text-xs text-muted-foreground">
                Clientes, creditos y pagos en un solo panel
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="text-left md:text-right">
                <p className="text-sm font-medium">
                  {usuario?.nombre ?? "Usuario"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {usuario?.email ?? ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void logout()}
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </Button>
            </div>
            <nav className="flex gap-2 overflow-x-auto md:hidden">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground",
                      active && "border-foreground text-foreground",
                    )}
                    title={item.label}
                  >
                    <Icon className="size-4" />
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
