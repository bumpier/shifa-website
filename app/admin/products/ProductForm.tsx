"use client";

import { useActionState } from "react";
import { saveProductAction } from "@/app/admin/actions";
import type { FormState } from "@/app/(store)/auth/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export interface ProductFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  priceAed: string;
  pricePkr: string;
  priceUsd: string;
  priceGbp: string;
  priceEur: string;
  stock: number;
  weightGrams: number;
  supplyDays: number;
  active: boolean;
  currentImage: string | null;
}

const PRICE_FIELDS = [
  { name: "priceAed", label: "Price (AED)" },
  { name: "pricePkr", label: "Price (PKR)" },
  { name: "priceUsd", label: "Price (USD)" },
  { name: "priceGbp", label: "Price (GBP)" },
  { name: "priceEur", label: "Price (EUR)" },
] as const;

export function ProductForm({ values }: { values: ProductFormValues }) {
  const [state, action] = useActionState(saveProductAction, initial);

  return (
    <form action={action} className="space-y-6">
      {values.id && <input type="hidden" name="productId" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required minLength={2} maxLength={150} defaultValue={values.name} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="slug">Slug (URL)</label>
          <input
            id="slug"
            name="slug"
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            maxLength={100}
            defaultValue={values.slug}
            className="field"
            placeholder="herbal-honey-250g"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          defaultValue={values.description}
          className="field"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        {PRICE_FIELDS.map((f) => (
          <div key={f.name}>
            <label className="label" htmlFor={f.name}>{f.label}</label>
            <input
              id={f.name}
              name={f.name}
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={values[f.name]}
              className="field"
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="stock">Stock</label>
          <input id="stock" name="stock" type="number" min="0" required defaultValue={values.stock} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="weightGrams">Weight (grams)</label>
          <input id="weightGrams" name="weightGrams" type="number" min="0" required defaultValue={values.weightGrams} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="supplyDays">Supply days / unit</label>
          <input id="supplyDays" name="supplyDays" type="number" min="0" max="3650" required defaultValue={values.supplyDays} className="field" />
          <p className="mt-1.5 text-xs text-ink-soft/70">0 = no repurchase reminder</p>
        </div>
        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="active"
              defaultChecked={values.active}
              className="h-4 w-4 accent-[rgb(var(--brand))]"
            />
            Visible in store
          </label>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="image">
          Product image {values.currentImage ? "(replaces current)" : ""}
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="field"
        />
        <p className="mt-1.5 text-xs text-ink-soft/70">JPEG, PNG or WebP, max 5MB.</p>
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary">
        {values.id ? "Save changes" : "Create product"}
      </SubmitButton>
    </form>
  );
}
