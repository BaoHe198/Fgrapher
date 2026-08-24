"use client";

import type { Booking, BookingStatus, Service, User } from "@prisma/client";
import { AlertTriangle, ArrowLeft, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { ReviewModal } from "@/components/modals/review-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { StarInput } from "@/components/ui/star-input";
import { Textarea } from "@/components/ui/textarea";
import { MIN_NOTICE_HOURS } from "@/lib/constants";
import { formatDate, formatDateTime, formatWeekdayShort } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { DayAvailability } from "@/services/availability";

type Party = Pick<User, "id" | "name" | "firstName" | "avatar" | "username"> & {
  roles?: { role: string }[];
};
type BookingDetail = Booking & {
  customer: Party;
  provider: Party;
  service: Pick<Service, "name" | "description" | "duration"> | null;
  review: { id: string } | null;
  // Crew-hire (Prompt B7, VIỆC 1).
  parentBooking: {
    id: string;
    status: BookingStatus;
    date: string;
    service: { name: string } | null;
  } | null;
  childBookings: {
    id: string;
    status: BookingStatus;
    date: string;
    providerId: string;
    recipientRole: string | null;
    provider: { firstName: string | null; name: string | null };
  }[];
  // Anti-spam/safety (Prompt B7, VIỆC 4).
  isFirstBookingBetweenParties: boolean;
};

const STATUS_BADGE: Record<
  BookingStatus,
  { label: string; variant: "warning" | "success" | "neutral" | "destructive" }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  COMPLETED: { label: "Completed", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  DECLINED: { label: "Declined", variant: "destructive" },
  NO_SHOW: { label: "No-show", variant: "destructive" },
  EXPIRED: { label: "Expired", variant: "neutral" },
};

const LOCATION_LABEL: Record<string, string> = {
  PROVIDER: "At provider's studio",
  CUSTOMER: "At customer's location",
  OUTDOOR: "Outdoor / other",
};

const DECLINE_REASONS = [
  { value: "Unavailable", label: "Unavailable" },
  { value: "Outside my service area", label: "Outside my service area" },
  { value: "Not my specialty", label: "Not my specialty" },
  { value: "Other", label: "Other" },
];

function partyName(party: Party) {
  return party.firstName ?? party.name ?? "Unknown";
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);
  const [busy, setBusy] = useState(false);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState(DECLINE_REASONS[0].value);
  const [declineMessage, setDeclineMessage] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);

  const load = () => {
    fetch(`/api/bookings/${params.id}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFoundError(true);
          return null;
        }
        return res.json();
      })
      .then((body) => {
        startTransition(() => {
          if (body?.data) setBooking(body.data);
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    load();
    // `load` is a fresh closure every render but only truly depends on
    // params.id — re-fetches exactly when navigating to a different
    // booking, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const updateStatus = async (
    status: "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
    reason?: string,
  ) => {
    setBusy(true);
    await fetch(`/api/bookings/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancelReason: reason }),
    });
    setBusy(false);
    setAcceptOpen(false);
    setDeclineOpen(false);
    setCancelOpen(false);
    setIsLoading(true);
    load();
  };

  const respondReschedule = async (accept: boolean) => {
    setBusy(true);
    await fetch(`/api/bookings/${params.id}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    setBusy(false);
    setIsLoading(true);
    load();
  };

  if (notFoundError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-body-lg font-semibold text-text-primary">
          Booking not found
        </p>
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/dashboard/bookings" />}
        >
          Back to bookings
        </Button>
      </div>
    );
  }

  if (isLoading || !booking) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  const viewerIsProvider = session?.user?.id === booking.provider.id;
  const otherParty = viewerIsProvider ? booking.customer : booking.provider;
  const status = STATUS_BADGE[booking.status];
  const isPast = new Date(booking.date).getTime() < now;
  const withinCancellationWindow =
    new Date(booking.date).getTime() - now < MIN_NOTICE_HOURS * 60 * 60 * 1000;
  const hasReschedulePending = Boolean(booking.rescheduleProposedBy);
  const proposedByMe = booking.rescheduleProposedBy === session?.user?.id;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/bookings"
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold text-text-secondary"
      >
        <ArrowLeft className="size-4" />
        Back to bookings
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-display-md text-text-primary">Booking details</h1>
        <Badge variant={status.variant}>{status.label}</Badge>
        <span className="text-body-sm text-text-tertiary">
          #{booking.id.slice(-8)} · Requested {formatDate(booking.createdAt)}
        </span>
      </div>

      {booking.isFirstBookingBetweenParties && booking.status === "PENDING" ? (
        <Card className="flex flex-col gap-1.5 border border-warning bg-warning-bg">
          <span className="flex items-center gap-1.5 text-body-md font-semibold text-text-primary">
            <AlertTriangle className="size-4" />
            First time working with {partyName(otherParty)}?
          </span>
          <p className="text-body-sm text-text-secondary">
            For your first session together, meet in a public place if possible
            and let a friend or family member know your schedule and location.
          </p>
        </Card>
      ) : null}

      {booking.parentBooking ? (
        <Card className="flex items-center justify-between gap-2">
          <span className="text-body-sm text-text-secondary">
            Part of a crew for{" "}
            <Link
              href={`/dashboard/bookings/${booking.parentBooking.id}`}
              className="font-semibold text-text-link hover:underline"
            >
              {booking.parentBooking.service?.name ?? "a client booking"} on{" "}
              {formatDate(booking.parentBooking.date)}
            </Link>
          </span>
          <Badge variant="neutral">{booking.parentBooking.status}</Badge>
        </Card>
      ) : null}

      {booking.childBookings.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <span className="text-body-sm font-semibold text-text-primary">
            Crew booked for this job
          </span>
          {booking.childBookings.map((child) => (
            <div
              key={child.id}
              className="flex items-center justify-between gap-2"
            >
              <Link
                href={`/dashboard/bookings/${child.id}`}
                className="text-body-sm text-text-link hover:underline"
              >
                {child.provider.firstName ?? child.provider.name ?? "Unknown"}
                {child.recipientRole ? ` — ${child.recipientRole}` : ""}
              </Link>
              <Badge variant="neutral">{child.status}</Badge>
            </div>
          ))}
        </Card>
      ) : null}

      {hasReschedulePending ? (
        <Card className="flex flex-col gap-2 border border-brand-primary bg-success-bg">
          <span className="text-body-md font-semibold text-text-primary">
            {proposedByMe
              ? "Waiting for a response to your proposed time"
              : "New time proposed"}
          </span>
          <span className="text-body-sm text-text-secondary">
            {formatDate(booking.rescheduleProposedDate!)} at{" "}
            {booking.rescheduleProposedStartTime}
          </span>
          {!proposedByMe ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="accent"
                disabled={busy}
                onClick={() => respondReschedule(true)}
              >
                Accept new time
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => respondReschedule(false)}
              >
                Keep original time
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                {otherParty.avatar ? (
                  <AvatarImage src={otherParty.avatar} alt="" />
                ) : null}
                <AvatarFallback>
                  {partyName(otherParty)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-body-md font-semibold text-text-primary">
                  {partyName(otherParty)}
                  {(otherParty.roles?.length ?? 0) > 0 ? (
                    <Badge variant="accent">Verified</Badge>
                  ) : null}
                </span>
                <span className="text-body-sm text-text-secondary">
                  {viewerIsProvider ? "Client" : "Provider"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {otherParty.username ? (
                <Button
                  size="sm"
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href={`/profile/${otherParty.username}`} />}
                >
                  View profile
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                nativeButton={false}
                render={
                  <Link href={`/dashboard/messages?to=${otherParty.id}`} />
                }
              >
                Message
              </Button>
            </div>
          </Card>

          <Card
            className="flex flex-col divide-y divide-border-subtle"
            padding={false}
          >
            {[
              ["Service", booking.service?.name ?? "Custom request"],
              ["Date", formatDate(booking.date)],
              [
                "Time",
                booking.endTime
                  ? `${booking.startTime} – ${booking.endTime}`
                  : booking.startTime,
              ],
              [
                "Duration",
                booking.service ? `${booking.service.duration} min` : "—",
              ],
              [
                "Location",
                booking.locationType
                  ? LOCATION_LABEL[booking.locationType]
                  : "—",
              ],
              [
                "People",
                booking.numberOfPeople ? String(booking.numberOfPeople) : "—",
              ],
              [
                "Total",
                booking.totalPrice
                  ? formatCurrency(booking.totalPrice, booking.currency)
                  : "—",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <span className="text-body-sm text-text-tertiary">{label}</span>
                <span className="text-body-md font-semibold text-text-primary">
                  {value}
                </span>
              </div>
            ))}
          </Card>

          {booking.locationAddress ? (
            <Card className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
              <span className="text-body-md text-text-primary">
                {booking.locationAddress}
              </span>
            </Card>
          ) : null}

          {booking.notes ? (
            <Card className="flex flex-col gap-1.5">
              <span className="text-body-sm text-text-tertiary">Notes</span>
              <p className="whitespace-pre-line text-body-md text-text-primary">
                {booking.notes}
              </p>
            </Card>
          ) : null}

          {booking.status === "COMPLETED" &&
          !viewerIsProvider &&
          !booking.review ? (
            <Card className="flex flex-col items-center gap-3 text-center">
              <span className="text-body-lg font-semibold text-text-primary">
                How was your session with {partyName(otherParty)}?
              </span>
              <StarInput
                value={reviewRating}
                onChange={(value) => {
                  setReviewRating(value);
                  setReviewOpen(true);
                }}
              />
            </Card>
          ) : null}

          <Card className="flex flex-col gap-2.5">
            <span className="text-body-sm text-text-tertiary">Timeline</span>
            <TimelineRow label="Request created" date={booking.createdAt} />
            {booking.status === "CANCELLED" || booking.status === "DECLINED" ? (
              <TimelineRow
                label={
                  booking.status === "CANCELLED" ? "Cancelled" : "Declined"
                }
                date={booking.updatedAt}
                detail={booking.cancelReason}
              />
            ) : null}
            {booking.status === "COMPLETED" && booking.completedAt ? (
              <TimelineRow label="Marked complete" date={booking.completedAt} />
            ) : null}
          </Card>
        </div>

        <div className="sticky top-[104px] flex flex-col gap-3">
          <Card className="flex flex-col gap-2.5">
            {booking.status === "PENDING" && viewerIsProvider ? (
              <>
                <Button
                  variant="accent"
                  disabled={busy}
                  onClick={() => setAcceptOpen(true)}
                >
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setDeclineOpen(true)}
                >
                  Decline
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setRescheduleOpen(true)}
                >
                  Propose new time
                </Button>
              </>
            ) : null}

            {booking.status === "PENDING" && !viewerIsProvider ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
              >
                Cancel request
              </Button>
            ) : null}

            {booking.status === "CONFIRMED" ? (
              <>
                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={
                    <Link href={`/dashboard/messages?to=${otherParty.id}`} />
                  }
                >
                  Message
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setRescheduleOpen(true)}
                >
                  Reschedule
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel
                </Button>
                {viewerIsProvider && isPast ? (
                  <>
                    <Button
                      variant="accent"
                      disabled={busy}
                      onClick={() => updateStatus("COMPLETED")}
                    >
                      Mark completed
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => updateStatus("NO_SHOW")}
                    >
                      Report no-show
                    </Button>
                  </>
                ) : null}
              </>
            ) : null}

            {booking.status === "COMPLETED" ||
            booking.status === "CANCELLED" ||
            booking.status === "DECLINED" ||
            booking.status === "NO_SHOW" ? (
              <p className="text-body-sm text-text-secondary">
                This booking is {status.label.toLowerCase()} — no further action
                needed.
              </p>
            ) : null}
          </Card>

          {booking.totalPrice ? (
            <Card className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">Total</span>
              <span className="text-heading-sm font-bold text-text-primary">
                {formatCurrency(booking.totalPrice, booking.currency)}
              </span>
            </Card>
          ) : null}

          {withinCancellationWindow &&
          !isPast &&
          (booking.status === "PENDING" || booking.status === "CONFIRMED") ? (
            <Card className="flex items-start gap-2 border border-warning/40 bg-warning-bg">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span className="text-body-sm text-text-primary">
                Less than 24 hours until this booking — cancelling now may be
                subject to a fee once payments are enabled.
              </span>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm this booking?</DialogTitle>
          </DialogHeader>
          <p className="text-body-md text-text-secondary">
            {partyName(booking.customer)} will be notified and the slot will be
            locked in for {formatDate(booking.date)} at {booking.startTime}.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcceptOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() => updateStatus("CONFIRMED")}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this booking</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <NativeSelect
              label="Reason"
              value={declineReason}
              onChange={setDeclineReason}
              options={DECLINE_REASONS}
            />
            <Textarea
              placeholder="Optional message to the customer..."
              value={declineMessage}
              onChange={(e) => setDeclineMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
              Back
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() =>
                updateStatus(
                  "DECLINED",
                  declineMessage
                    ? `${declineReason} — ${declineMessage}`
                    : declineReason,
                )
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Decline booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {withinCancellationWindow ? (
              <div className="flex items-start gap-2 rounded-[var(--fg-radius-md)] bg-warning-bg p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span className="text-body-sm text-text-primary">
                  This is within 24 hours of the booking — the cancellation
                  policy may apply once payments are enabled.
                </span>
              </div>
            ) : null}
            <Textarea
              placeholder="Reason for cancelling (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep booking
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                updateStatus("CANCELLED", cancelReason || undefined)
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        providerId={booking.provider.id}
        serviceDuration={booking.service?.duration}
        onProposed={() => {
          setRescheduleOpen(false);
          setIsLoading(true);
          load();
        }}
      />

      {booking.status === "COMPLETED" && !viewerIsProvider ? (
        <ReviewModal
          open={reviewOpen}
          onOpenChange={(open) => {
            setReviewOpen(open);
            if (!open) setReviewRating(0);
          }}
          bookingId={booking.id}
          providerName={partyName(otherParty)}
          serviceName={booking.service?.name}
          initialRating={reviewRating}
          onSuccess={() => {
            setIsLoading(true);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function TimelineRow({
  label,
  date,
  detail,
}: {
  label: string;
  date: string | Date;
  detail?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-l-2 border-border-subtle pl-3">
      <span className="text-body-sm font-semibold text-text-primary">
        {label}
      </span>
      <span className="text-body-sm text-text-tertiary">
        {formatDateTime(date)}
      </span>
      {detail ? (
        <span className="text-body-sm text-text-secondary">{detail}</span>
      ) : null}
    </div>
  );
}

function RescheduleDialog({
  open,
  onOpenChange,
  providerId,
  serviceDuration,
  onProposed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  serviceDuration: number | undefined;
  onProposed: () => void;
}) {
  const params = useParams<{ id: string }>();
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      setIsLoading(true);
      setDate(null);
      setTime(null);
    });
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/availability/${providerId}?from=${today}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setDays(body.data?.dates ?? []);
          setIsLoading(false);
        });
      });
  }, [open, providerId]);

  const activeDay = days.find((d) => d.date === date);

  const onSubmit = async () => {
    if (!date || !time) return;
    setBusy(true);
    const endMinutes =
      Number(time.slice(0, 2)) * 60 +
      Number(time.slice(3)) +
      (serviceDuration ?? 60);
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    await fetch(`/api/bookings/${params.id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startTime: time, endTime }),
    });
    setBusy(false);
    onProposed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose a new time</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day) => {
                const d = new Date(day.date);
                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={day.busy}
                    onClick={() => {
                      setDate(day.date);
                      setTime(null);
                    }}
                    className={`flex flex-col items-center gap-0.5 rounded-[var(--fg-radius-sm)] py-2 text-body-sm ${
                      date === day.date
                        ? "bg-brand-primary text-text-on-brand"
                        : day.busy
                          ? "cursor-not-allowed text-text-tertiary opacity-40"
                          : "cursor-pointer hover:bg-bg-sunken"
                    }`}
                  >
                    <span className="text-text-tertiary">
                      {formatWeekdayShort(d)}
                    </span>
                    <span className="font-semibold">{d.getUTCDate()}</span>
                  </button>
                );
              })}
            </div>

            {activeDay ? (
              <div className="grid grid-cols-3 gap-2">
                {activeDay.slots
                  .filter((s) => s.available)
                  .map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setTime(slot.time)}
                      className={`rounded-[var(--fg-radius-sm)] border py-2 text-body-sm font-semibold ${
                        time === slot.time
                          ? "border-transparent bg-brand-primary text-text-on-brand"
                          : "border-border-default bg-bg-surface text-text-primary"
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!date || !time || busy}
            onClick={onSubmit}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Send proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
