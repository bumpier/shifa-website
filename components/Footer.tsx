import Link from "next/link";
import { brand } from "@/config/brand";

export function Footer() {
  return (
    <footer className="no-print mt-24 border-t border-line bg-brand-tint/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt="" className="h-8 w-auto" />
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              {brand.tagline}
            </p>
          </div>

          <div className="text-sm">
            <p className="eyebrow mb-3">Our promise</p>
            <ul className="space-y-2 text-ink-soft">
              <li>{brand.trust.secureLine}</li>
              <li>{brand.trust.shippingLine}</li>
            </ul>
          </div>

          <div className="text-sm">
            <p className="eyebrow mb-3">Contact</p>
            <ul className="space-y-2 text-ink-soft">
              <li>
                <a href={`mailto:${brand.contact.email}`} className="hover:text-brand">
                  {brand.contact.email}
                </a>
              </li>
              <li>{brand.contact.phone}</li>
              <li>
                <Link href="/privacy" className="hover:text-brand">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs text-ink-soft/70">
          © {new Date().getFullYear()} All rights reserved.
        </p>
      </div>
    </footer>
  );
}
