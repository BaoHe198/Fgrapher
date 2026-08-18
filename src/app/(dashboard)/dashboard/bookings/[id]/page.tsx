import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, firstName: true } },
      provider: { select: { name: true, firstName: true } },
      service: { select: { name: true, description: true } },
    },
  });

  if (
    !booking ||
    (booking.customerId !== session.user.id && booking.providerId !== session.user.id)
  ) {
    notFound();
  }

  const rows: [string, string][] = [
    ["Client", booking.customer.firstName ?? booking.customer.name ?? "—"],
    ["Provider", booking.provider.firstName ?? booking.provider.name ?? "—"],
    ["Service", booking.service?.name ?? "—"],
    ["Date", new Date(booking.date).toLocaleDateString("en-US", { dateStyle: "long" })],
    ["Time", booking.endTime ? `${booking.startTime} – ${booking.endTime}` : booking.startTime],
    [
      "Total",
      booking.totalPrice ? formatCurrency(booking.totalPrice, booking.currency) : "—",
    ],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/bookings"
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold text-text-secondary"
      >
        <ArrowLeft className="size-4" />
        Back to bookings
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-display-md text-text-primary">Booking details</h1>
        <Badge variant="neutral">{booking.status}</Badge>
      </div>

      <Card className="flex flex-col divide-y divide-border-subtle" padding={false}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-body-sm text-text-tertiary">{label}</span>
            <span className="text-body-md font-semibold text-text-primary">{value}</span>
          </div>
        ))}
      </Card>

      {booking.notes ? (
        <Card className="flex flex-col gap-1.5">
          <span className="text-body-sm text-text-tertiary">Notes</span>
          <p className="text-body-md text-text-primary">{booking.notes}</p>
        </Card>
      ) : null}
    </div>
  );
}
