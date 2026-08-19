import { ProductForm } from "@/components/forms/product-form";
import { SubscriptionGate } from "@/components/subscription-gate";

export default function NewProductPage() {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-display-md text-text-primary">Add product</h1>
      <SubscriptionGate
        role="CAMERA_SHOP"
        fallbackTitle="Camera Shop subscription required"
        fallbackText="Activate your Camera Shop subscription to list products."
      >
        <ProductForm />
      </SubscriptionGate>
    </div>
  );
}
