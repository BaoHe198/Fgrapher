/**
 * services/bookings.ts throws BookingActionError with an English message
 * (useful in logs). Those messages used to reach the booking screens
 * verbatim — "That time slot was just booked — pick another" in a Vietnamese
 * app. Each one maps to a key under apiMessages.bookingErrors; the unit test
 * fails if a new message is thrown without an entry here.
 */
export const BOOKING_ERROR_KEYS: Record<string, string> = {
  "Booking not found": "notFound",
  "You are not a participant in this booking": "notParticipant",
  "Uploaded media could not be verified": "mediaUnverified",
  "That time slot was just booked — pick another": "slotTaken",
  "That new time was just taken — propose another": "newTimeTaken",
  "You cannot book as this role": "cannotBookAsRole",
  "You can't book yourself": "cannotBookSelf",
  "Wait for the other party to respond": "awaitOtherParty",
  "This transition can only be made automatically": "automaticOnly",
  "This role does not accept bookings": "roleNotBookable",
  "This role combination is not allowed for bookings": "roleComboNotAllowed",
  "This booking can no longer be rescheduled": "cannotReschedule",
  "The system actor can only expire bookings": "systemOnlyExpires",
  "That date or time isn't available for this provider": "timeUnavailable",
  "Service not found": "serviceNotFound",
  "Provider-role bookings must be linked to a confirmed customer booking":
    "crewNeedsParent",
  "Provider is not accepting bookings": "notAccepting",
  "Only the provider can report this outcome": "providerOnlyOutcome",
  "Only the provider can accept or decline a booking": "providerOnlyRespond",
  "No pending reschedule proposal": "noProposal",
  "Invalid parent booking — must be one of your own confirmed bookings":
    "invalidParent",
  "Can't report an outcome before the booking date": "outcomeTooEarly",
  "A crew booking must use your provider role": "crewNeedsProviderRole",
};
