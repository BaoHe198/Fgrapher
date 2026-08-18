# Phase 8 — Messaging

**Thời gian:** ~2 tuần
**Design file:** `ChatDock.jsx`
**Kết quả:** Chat real-time giữa users, với conversation list, typing indicator, read receipts.

---

## Step 1 — Chat UI

**Prompt:**

```
Read the ChatDock component in my design file.

Create the messaging interface:

1. src/app/(dashboard)/messages/page.tsx:
   Layout: grid grid-cols-[340px_1fr], height calc(100vh - 72px - 64px)
   - Left: conversation list
   - Right: active chat (or empty state)

2. Conversation list (src/components/chat/conversation-list.tsx):
   Container: border-r border-subtle, flex flex-col, overflow-hidden

   Header (p-4, border-b border-subtle):
   - H2: text-heading-lg — "Messages"
   - Search input below (compact, with Search icon)

   List (flex-1, overflow-y-auto):
   Each conversation item:
   - flex items-center gap-3, p-3.5, cursor-pointer
   - Unselected: hover:bg-sunken
   - Selected: bg-success-bg
   - Avatar (44px) with online dot indicator (10px, bg-success,
     border-2 border-surface, absolute bottom-0 right-0)
   - Middle (flex-1, min-w-0):
     - Row 1: name (text-body-md, font-semibold, truncate) +
       role badge (tiny)
     - Row 2: last message preview (text-body-sm, text-secondary,
       truncate). Prefix "You: " if the last message was sent by me
   - Right (flex flex-col items-end gap-1):
     - Time: text-body-sm, text-tertiary ("2m", "1h", "Yesterday")
     - Unread badge: min-w-5 h-5, rounded-full, bg-brand-primary,
       text-on-brand, text-xs, centered (only if unread > 0)

   Empty state: "No conversations yet" + "Message an artist to start"

3. Chat panel (src/components/chat/chat-panel.tsx):
   Container: flex flex-col, height full

   Header (p-4, border-b border-subtle, flex items-center gap-3):
   - Avatar (40px) + online status
   - Name (text-heading-sm) + role badge + online/last-seen text
   - Right: action icons — Phone, Video (disabled/coming soon),
     MoreVertical dropdown (View profile, Block, Report, Delete chat)

   Message area (flex-1, overflow-y-auto, p-5, flex flex-col gap-3):
   - Date separators: centered text-body-sm, text-tertiary,
     with lines on either side ("Today", "Yesterday", "14 March")
   - Message bubbles:
     Sent (own): self-end, max-w-[70%]
       bg-brand-primary, text-on-brand
       rounded-[16px_16px_4px_16px]
       px-4 py-2.5, text-body-md
     Received: self-start, max-w-[70%]
       bg-surface-card, text-primary, border border-subtle
       rounded-[16px_16px_16px_4px]
       px-4 py-2.5
     - Timestamp below each (text-xs, text-tertiary, mt-1)
     - Read receipt on sent messages: single check (sent),
       double check (read, in gold-400)
   - Image messages: rounded, max-w-[280px], clickable → lightbox
   - Booking link messages: special card with booking summary +
     "View booking" button
   - Typing indicator: three animated dots in a received-style bubble

   Input area (p-4, border-t border-subtle):
   - flex items-end gap-2
   - Attach button (Paperclip icon, ghost)
   - Textarea: auto-growing (1-5 rows), rounded-[var(--radius-md)],
     border border-default, px-3.5 py-2.5, resize-none
     placeholder "Write a message..."
     Enter sends, Shift+Enter newline
   - Send button (accent, icon Send, rounded-full, 40px)
     Disabled when empty

4. Empty state (no conversation selected):
   - Centered, MessageCircle icon (64px, text-tertiary)
   - "Select a conversation" + "Choose from the list to start chatting"

Responsive (< 1024px):
- Show only the list, tapping a conversation navigates to
  /dashboard/messages/[conversationId] (full-screen chat with a back button)
```

---

## Step 2 — Messaging API

**Prompt:**

```
Build the messaging backend:

1. Update the Prisma schema if needed — the Conversation model
   currently uses participantIds String[]. Change to a proper
   join table for better querying:

   model Conversation {
     id            String   @id @default(cuid())
     lastMessageAt DateTime?
     createdAt     DateTime @default(now())
     updatedAt     DateTime @updatedAt
     participants  ConversationParticipant[]
     messages      Message[]
     @@map("conversations")
   }

   model ConversationParticipant {
     id             String   @id @default(cuid())
     conversationId String
     userId         String
     lastReadAt     DateTime?
     joinedAt       DateTime @default(now())
     conversation   Conversation @relation(fields: [conversationId],
                      references: [id], onDelete: Cascade)
     user           User @relation(fields: [userId], references: [id])
     @@unique([conversationId, userId])
     @@index([userId, conversationId])
     @@map("conversation_participants")
   }

   Create the migration.

2. API routes:

   GET /api/conversations
   - List conversations where the user is a participant
   - Include: other participant's user data, last message,
     unread count (messages after lastReadAt)
   - Order by lastMessageAt desc
   - Paginated

   POST /api/conversations
   - Body: { userId } — the person to start a chat with
   - Find an existing 1-on-1 conversation between these two users
   - If none, create one
   - Return the conversation

   GET /api/conversations/[id]/messages
   - Verify the user is a participant
   - Paginated, newest first, cursor-based (using message id)
   - Return in chronological order for display

   POST /api/messages
   - Body: { conversationId, content, type, mediaUrl? }
   - Verify participation
   - Create the message
   - Update conversation.lastMessageAt
   - Emit socket event to the other participant
   - Create a notification if they're offline
   - Return the message

   PATCH /api/conversations/[id]/read
   - Update the participant's lastReadAt to now
   - Emit a read-receipt socket event

3. Create src/services/messaging.ts with the business logic
   so routes stay thin.
```

---

## Step 3 — Real-time with Socket.io

**Prompt:**

```
Add real-time messaging with Socket.io.

Note: Next.js App Router on Vercel doesn't support long-lived
WebSocket connections in serverless functions. Two options:

Option A (recommended for Vercel): Use Pusher or Ably
- Managed service, free tier is generous
- Simpler, no separate server needed

Option B: Self-hosted Socket.io server
- Deploy a separate Node server (Railway, Render, Fly.io)
- More control, no per-message cost

Implement Option A with Pusher:

1. Install: pnpm add pusher pusher-js

2. Create src/lib/pusher.ts:
   - Server client (pusher) for triggering events
   - Client-side helper for subscribing

3. Channel naming:
   - private-user-{userId} — personal channel for notifications
   - presence-conversation-{conversationId} — for typing/presence

4. Server: trigger events in the API routes
   - On new message: trigger 'new-message' on the recipient's
     private channel with the message payload
   - On read: trigger 'messages-read' with conversationId + timestamp
   - On typing: a lightweight endpoint POST /api/messages/typing
     that triggers 'typing' on the conversation channel

5. Auth endpoint src/app/api/pusher/auth/route.ts:
   - Verify the session
   - Verify the user can access the requested channel
   - Return the auth signature

6. Client hook src/hooks/use-chat.ts:
   export function useChat(conversationId?: string) {
     - Subscribe to the user's private channel on mount
     - Subscribe to the conversation presence channel when
       a conversation is open
     - Handle 'new-message': append to the message list,
       update the conversation list
     - Handle 'typing': show/hide the typing indicator with a
       3-second timeout
     - Handle 'messages-read': update read receipts
     - Cleanup subscriptions on unmount
     Returns: { messages, sendMessage, isTyping, setTyping, onlineUsers }
   }

7. Optimistic UI:
   - When sending, immediately append the message with a
     'sending' status
   - On API success, replace with the real message
   - On failure, show a retry button on that message

8. Online presence:
   - Use Pusher presence channels
   - Show the online dot on avatars
   - Show "Active now" or "Last seen 2h ago" in the chat header
```

---

## Step 4 — Chat integrations

**Prompt:**

```
Connect messaging to the rest of the app:

1. "Message" buttons throughout:
   - Profile page booking sidebar: "Message {name}"
   - Booking detail page: "Message" action
   - Artist cards: optional message icon
   All call POST /api/conversations with the target userId,
   then navigate to /dashboard/messages?c={conversationId}

2. Booking link messages:
   - When a booking is created, auto-send a system message in the
     conversation with type 'booking_link' and the booking id
   - Render as a special card: service name, date, time, status badge,
     "View booking" button

3. Quick replies / templates (provider convenience):
   - Small chip row above the input with common replies:
     "Yes, I'm available" / "Let me check my calendar" /
     "Here's my rate card" / "Can we reschedule?"
   - Clicking inserts the text into the input
   - Providers can save custom templates in settings

4. Image sharing:
   - Attach button opens a file picker
   - Upload to Cloudinary
   - Send as a message with type 'image' and the URL
   - Render inline with a click-to-expand lightbox

5. Unread badge in navigation:
   - WebNav MessageCircle icon shows a dot/count when unread > 0
   - Dashboard sidebar Messages item shows the count
   - Poll GET /api/conversations/unread-count every 30s, or
     update via the Pusher event

6. Notification integration:
   - If the recipient has no active Pusher connection (offline),
     create a Notification record and send an email
   - Debounce emails: max one email per conversation per 15 minutes

7. Message search:
   - Search input in the conversation list header
   - Searches both participant names and message content
   - GET /api/messages/search?q=
```

---

## Step 5 — Moderation & safety

**Prompt:**

```
Add safety features to messaging:

1. Block user:
   - Add a BlockedUser model:
     model BlockedUser {
       id        String   @id @default(cuid())
       blockerId String
       blockedId String
       reason    String?
       createdAt DateTime @default(now())
       @@unique([blockerId, blockedId])
       @@map("blocked_users")
     }
   - Blocked users can't send messages or book
   - Their existing conversation is hidden
   - API: POST/DELETE /api/blocks

2. Report conversation:
   - Report modal: reason select (Spam, Harassment, Scam,
     Inappropriate content, Other) + description
   - Creates a Report record for admin review
   - API: POST /api/reports

3. Basic content filtering:
   - Warn when a message contains an external contact
     (phone number, email, social handle) with a note:
     "Keep conversations on Fgrapher for your protection"
   - Don't block, just warn — many legitimate exchanges need this
   - Flag messages with suspicious patterns for admin review

4. Rate limiting:
   - Max 30 messages per minute per user
   - Max 5 new conversations per hour for new accounts
   - Use Upstash Redis or a simple in-memory counter

5. Safety notice:
   - First message in any new conversation shows a system notice:
     "Stay safe: never share payment details outside Fgrapher.
      Report anything suspicious."
```

---

## Step 6 — Test & commit

**Prompt:**

```
Test messaging thoroughly:

Setup: open two browser windows, log in as different users
(photographer@test.com and customer@test.com)

Test:
- Customer opens photographer's profile → clicks "Message"
- Conversation created, chat opens
- Send a message → appears immediately (optimistic)
- Other window receives it in real-time without refresh
- Conversation list updates with the new last message
- Unread badge appears on the recipient's nav
- Recipient opens the conversation → unread clears, read receipt
  appears on sender's side (double check)
- Type in one window → typing indicator appears in the other
- Stop typing → indicator disappears after 3s
- Send an image → uploads, renders inline, lightbox opens on click
- Create a booking → system message with booking card appears
- Click "View booking" → navigates to the booking detail
- Search conversations by name → filters correctly
- Block a user → conversation hidden, can't send
- Unblock → conversation restored
- Report a conversation → report created in the database
- Rate limit: send 31 messages rapidly → blocked with a message
- Offline recipient: close one window, send a message →
  notification + email created
- Mobile: list and chat are separate screens with back navigation
- Dark mode on all chat UI

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(messaging): Phase 8 — real-time chat, conversations, presence, moderation"
```

---

## Checklist hoàn thành Phase 8

- [ ] Conversation list với unread badges
- [ ] Chat panel với message bubbles đúng design
- [ ] Real-time messaging (Pusher hoặc Socket.io)
- [ ] Typing indicator
- [ ] Read receipts
- [ ] Online presence
- [ ] Optimistic UI khi gửi tin
- [ ] Image sharing qua Cloudinary
- [ ] Booking link messages
- [ ] Quick reply templates
- [ ] Unread count trong nav + sidebar
- [ ] Email notification khi offline
- [ ] Block / Report / Rate limiting
- [ ] Mobile: separate list và chat screens

**→ Tiếp theo:** Phase 9 — Marketplace
