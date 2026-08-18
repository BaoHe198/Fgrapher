import { CreditCard } from "lucide-react";

import { Card } from "@/components/ui/card";

export default function BillingSettingsPage() {
  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <CreditCard className="size-12 text-text-tertiary" />
      <p className="text-body-lg font-semibold text-text-primary">Billing is coming soon</p>
      <p className="max-w-sm text-body-md text-text-secondary">
        Subscription management and invoices will live here once payments launch.
      </p>
    </Card>
  );
}
