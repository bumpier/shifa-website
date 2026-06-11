import { cookies } from "next/headers";
import { CartProvider } from "@/components/CartProvider";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { currentCurrency } from "@/lib/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await cookies()).get("session")?.value;

  return (
    <CurrencyProvider initial={await currentCurrency()}>
      <CartProvider>
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header signedIn={signedIn} />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </CartProvider>
    </CurrencyProvider>
  );
}
