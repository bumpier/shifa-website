import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Your data</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-brand-deep">
        Privacy policy
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="mb-2 font-semibold text-ink">What we collect</h2>
          <p>
            To fulfil your order we collect only what is necessary: your name, email
            address, phone number and shipping address. That is all.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-ink">Payment details</h2>
          <p>
            We never see or store your payment details. All payments are made in
            cryptocurrency and processed by our payment provider (Heleket) on
            their own infrastructure.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-ink">Cookies</h2>
          <p>
            We use a small number of functional cookies: your currency preference, your
            cart, and if you arrived via a partner link, a referral code that expires
            after 30 days. We do not use advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-ink">Affiliate accounts</h2>
          <p>
            If you hold an affiliate account, we additionally store your login details
            (password securely hashed) and the bank details you provide for payouts,
            which are encrypted at rest.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-ink">Data deletion</h2>
          <p>
            To request deletion of your data, email{" "}
            <a href={`mailto:${brand.contact.email}`} className="text-brand underline underline-offset-2">
              {brand.contact.email}
            </a>{" "}
            and we will action it promptly.
          </p>
        </section>
      </div>
    </div>
  );
}
