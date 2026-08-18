"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ProductImageUploader, type ProductImage } from "@/components/forms/product-image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { Switch } from "@/components/ui/switch";
import { PRODUCT_CATEGORIES, productSchema, type ProductInput } from "@/lib/validations/product";

const CONDITION_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
];

interface ProductFormProps {
  productId?: string;
  defaultValues?: Partial<ProductInput>;
}

export function ProductForm({ productId, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "Camera body",
      type: "SALE",
      condition: "NEW",
      stock: 1,
      isActive: true,
      images: [],
      ...defaultValues,
    },
  });

  const type = watch("type");

  const onSubmit = async (values: ProductInput) => {
    setServerError(null);

    const res = await fetch(productId ? `/api/products/${productId}` : "/api/products", {
      method: productId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json();
      setServerError(body.message ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/dashboard/listings");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError ? (
        <div className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
          {serverError}
        </div>
      ) : null}

      <Input label="Name" placeholder="Canon EOS R5" error={errors.name?.message} {...register("name")} />

      <div className="flex flex-col gap-1.5">
        <label className="text-body-sm font-semibold text-text-primary">Description</label>
        <textarea
          className="min-h-24 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
          {...register("description")}
        />
      </div>

      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <NativeSelect
            label="Category"
            options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-semibold text-text-primary">Type</span>
        <div className="flex gap-4">
          <Radio label="For sale" value="SALE" {...register("type")} checked={type === "SALE"} />
          <Radio label="For rent" value="RENT" {...register("type")} checked={type === "RENT"} />
          <Radio label="Both" value="BOTH" {...register("type")} checked={type === "BOTH"} />
        </div>
      </div>

      {type === "SALE" || type === "BOTH" ? (
        <Input
          label="Sale price"
          type="number"
          step="0.01"
          error={errors.price?.message}
          {...register("price", { valueAsNumber: true })}
        />
      ) : null}

      {type === "RENT" || type === "BOTH" ? (
        <Input
          label="Rental price per day"
          type="number"
          step="0.01"
          error={errors.rentalPrice?.message}
          {...register("rentalPrice", { valueAsNumber: true })}
        />
      ) : null}

      <Controller
        control={control}
        name="condition"
        render={({ field }) => (
          <NativeSelect
            label="Condition"
            options={CONDITION_OPTIONS}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Input
        label="Stock quantity"
        type="number"
        error={errors.stock?.message}
        {...register("stock", { valueAsNumber: true })}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-body-sm font-semibold text-text-primary">Images</span>
        <Controller
          control={control}
          name="images"
          render={({ field }) => (
            <ProductImageUploader
              images={field.value as ProductImage[]}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <Switch label="Active" checked={field.value} onChange={field.onChange} />
        )}
      />

      <div className="flex gap-2.5">
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Save product
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/dashboard/listings")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
