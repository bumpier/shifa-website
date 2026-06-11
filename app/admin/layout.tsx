import Link from "next/link";
import { brand } from "@/config/brand";
import { isAdmin } from "@/lib/adminAuth";
import { adminLogoutAction } from "@/app/admin/actions";

// Middleware blocks unauthenticated access to everything except
// /admin/login; the nav simply hides when there is no session.

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/affiliates", label: "Affiliates" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isAdmin();

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="no-print border-b border-line bg-brand-deep text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold">{brand.name}</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Admin
              </span>
            </Link>
            {signedIn && (
              <nav className="flex items-center gap-4 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-white/75 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          {signedIn && (
            <form action={adminLogoutAction}>
              <button type="submit" className="text-sm text-white/75 hover:text-white">
                Sign out
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
