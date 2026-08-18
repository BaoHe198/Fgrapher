import { ProductForm } from "@/components/forms/product-form";

export default function NewProductPage() {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-display-md text-text-primary">Add product</h1>
      <ProductForm />
    </div>
  );
}
