import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { brandCssVariables } from "@/lib/theme";
import { bodyFont, displayFont } from "@/app/fonts";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://shifapk.com"),
  title: {
    default: `${brand.name} | ${brand.tagline}`,
    template: `%s | ${brand.name}`,
  },
  description:
    "ShifaPK offers premium natural wellness products shipped to UAE, Pakistan & worldwide. Pay with crypto and get 10% off.",
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} | ${brand.tagline}`,
    description:
      "ShifaPK offers premium natural wellness products shipped to UAE, Pakistan & worldwide. Pay with crypto and get 10% off.",
    images: [{ url: "/logo.png", width: 800, height: 600, alt: brand.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} | ${brand.tagline}`,
    description:
      "ShifaPK offers premium natural wellness products shipped to UAE, Pakistan & worldwide.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: brand.name,
  url: "https://shifapk.com",
  logo: "https://shifapk.com/logo.png",
  contactPoint: {
    "@type": "ContactPoint",
    email: brand.contact.email,
    telephone: brand.contact.phone,
    contactType: "customer service",
  },
  description:
    "ShifaPK offers premium natural wellness products shipped to UAE, Pakistan & worldwide.",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: brand.name,
  url: "https://shifapk.com",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://shifapk.com/products?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable}`}
      style={brandCssVariables() as React.CSSProperties}
    >
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {children}
        <WhatsAppWidget />
      </body>
    </html>
  );
}
