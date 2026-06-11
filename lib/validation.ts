import { z } from "zod";
import { brand } from "@/config/brand";

// Every form input and API body is validated with these schemas
// server-side before touching the database. All .strict().

const currencyEnum = z.enum(["AED", "PKR", "USD", "GBP", "EUR"]);

export const CheckoutSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().max(254),
    phone: z.string().regex(/^\+?[0-9\s\-]{7,20}$/),
    addressLine1: z.string().min(5).max(200).trim(),
    addressLine2: z.string().max(200).trim().optional().or(z.literal("")),
    city: z.string().min(2).max(100).trim(),
    country: z.string().min(2).max(100).trim(),
    postalCode: z.string().max(20).trim().optional().or(z.literal("")),
    currency: currencyEnum,
    paymentMethod: z.enum(["card", "jazzcash", "easypaisa"]),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          qty: z.number().int().min(1).max(50),
        }).strict()
      )
      .min(1)
      .max(50),
  })
  .strict();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const RegisterSchema = z
  .object({
    token: z.string().uuid(),
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().max(254).toLowerCase(),
    password: passwordSchema,
  })
  .strict();

export const LoginSchema = z
  .object({
    email: z.string().email().max(254).toLowerCase(),
    password: z.string().min(1).max(128),
  })
  .strict();

export const ForgotPasswordSchema = z
  .object({ email: z.string().email().max(254).toLowerCase() })
  .strict();

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(32).max(128),
    password: passwordSchema,
  })
  .strict();

export const BankDetailsSchema = z
  .object({
    bankName: z.string().min(2).max(100).trim(),
    bankAccountName: z.string().min(2).max(100).trim(),
    bankAccountNumber: z.string().regex(/^[A-Za-z0-9\s\-]{4,40}$/),
    bankIBAN: z.string().regex(/^[A-Za-z0-9\s]{0,40}$/).optional().or(z.literal("")),
    bankCountry: z.string().min(2).max(60).trim(),
  })
  .strict();

const priceField = z.coerce.number().min(0).max(1_000_000);

export const ProductSchema = z
  .object({
    name: z.string().min(2).max(150).trim(),
    slug: z
      .string()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
    description: z.string().min(10).max(5000).trim(),
    priceAed: priceField,
    pricePkr: priceField,
    priceUsd: priceField,
    priceGbp: priceField,
    priceEur: priceField,
    stock: z.coerce.number().int().min(0).max(1_000_000),
    weightGrams: z.coerce.number().int().min(0).max(1_000_000),
    active: z.coerce.boolean(),
  })
  .strict();

export const CommissionRateSchema = z
  .object({ rate: z.coerce.number().min(0).max(100) })
  .strict();

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export function defaultCurrency() {
  return brand.currency.default;
}

/** CSRF protection: mutating API routes must come from our own origin. */
export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("host");
  try {
    const o = new URL(origin);
    if (host && o.host === host) return true;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site && o.origin === new URL(site).origin) return true;
    return false;
  } catch {
    return false;
  }
}
