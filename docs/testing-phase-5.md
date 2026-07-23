# Phase 5 — manual test checklist

Notifications and announcements — the **in-app** experience (bell + unread
count). Lock-screen push and the home-screen icon badge come in Phase 8 with the
PWA; this phase builds the notifications they will carry.

**The worker must be running**, because fan-out happens off the request:

```bash
npm run worker          # its own terminal
npm run dev             # http://localhost:3120
```

If the worker is stopped, notifications just wait in the queue until it runs.

Sign-ins (password `ChangeMe!Local123`):

| Who | Email | Children |
|---|---|---|
| Owner | `owner@rihana.test` | — |
| Teacher · Sunflowers | `teacher.sun@rihana.test` | — |
| Teacher · Olives | `teacher.olive@rihana.test` | — |
| Parent · Amal | `amal@rihana.test` | Laila (Sunflowers), Omar (Olives) |
| Parent · Khalid | `khalid@rihana.test` | Zayn (Sunflowers) |
| Parent · Sami | `sami@rihana.test` | Tariq (Sunflowers) |
| Parent · Nour | `nour@rihana.test` | Hana (Olives), co-guardian of Tariq |

Legend: ✅ works · 🚫 refused · 🔒 security-critical.

---

## 1. Photo notifications

**Tagged photos — named per child, consent-gated**

- ✅ Owner uploads to Sunflowers, **tags Laila**, publishes → within seconds
      **Amal** gets a bell badge and "1 new photo of Laila".
- ✅ **Batched:** 3 photos tagged Laila, published once → **one** "3 new photos of
      Laila", not three.
- ✅ **Two children:** Amal (Laila + Omar) with photos of each → **two**
      notifications, one per child.
- ✅ **Two guardians:** a photo of **Tariq** notifies **both** Sami and Nour.
- 🔒 **Only the right family:** a photo tagged only with Laila → **Khalid gets
      nothing**.
- 🔒 **Consent:** a tagged child with consent **withdrawn** produces no
      notification (their tagged photos aren't visible anyway).

**Class-album photos — named per class, NOT consent-gated** *(this is the fix)*

- ✅ Publish a "whole class" Sunflowers photo → **every** Sunflowers family (Amal,
      Khalid, Sami) gets "N new class photos in Sunflowers".
- 🔒 **The case you found:** withdraw **Tariq's** consent, then publish a
      whole-class Sunflowers photo. It appears to **Sami** (class photos are
      class-level), **and Sami now also gets the class notification** — the photo
      and the notification are consistent. (Before, the photo showed with no
      notification; that was the bug.)
- ✅ A parent tagged in one photo *and* in a class with class-album photos in the
      same batch may get **both** a per-child and a per-class notification — that
      is expected; they are different things.

**Late photos — Option A (your choice)**

- ✅ Publishing is the notifying event. If you **tag a photo after** the session was
      already published (it becomes visible on its own), the family sees it but is
      **not** re-notified. Same for adding photos to a published upload, and for
      restoring consent. Deliberate — one clean batch per Publish, no trickle.

## 2. The bell & reading

- ✅ The bell shows an unread **count** (caps at "9+"); the list is newest-first,
      unread highlighted.
- ✅ **Tapping a notification** marks it read **and** opens what it's about
      (a photo notification → that child's photos; an announcement → the feed).
- ✅ **Mark all as read** clears the badge; reload confirms it stays cleared.
- ✅ "Load older" appears past one page of notifications.

## 3. Announcements — admin

- ✅ Owner posts **whole nursery** or **one class**; **Publish & notify** sends it.
- ✅ Markdown renders: `**bold**`, `*italic*`, `- bullets`, `[link](https://…)`.
- 🔒 `[x](javascript:alert(1))` renders as **plain text**; pasted `<script>` shows
      as text, never runs.
- ✅ **Edit** a draft or a live one (editing a live one does **not** re-notify).
- ✅ **Withdraw** removes it from families' portals **and deletes the notification**
      from their list. **Delete** (type the title) does the same.
- ✅ Withdraw then **re-publish** → families are notified **again** (the old
      notification was removed, so it is a fresh one).
- 🚫 **teacher.olive**: "New announcement" offers **no "whole nursery"** option, and
      opening/editing a Sunflowers announcement is a **404**.

## 4. Announcements — parent

- ✅ Amal sees whole-nursery announcements **and** those for **both** her classes
      (Sunflowers + Olives) — feed and Home dashboard.
- 🔒 An **Olives-only** announcement does **not** show for **Khalid** (Sunflowers).
- ✅ A **draft** announcement is invisible to families and notifies nobody.
- ✅ Publishing produces a notification; the body renders formatted, never raw
      `**stars**`.

## 5. Album notifications *(new)*

- ✅ Build and **publish an album** (with at least one already-published photo in
      it) → families who can see a photo in it get **"New album: <title>"**,
      linking to the album.
- 🔒 A family with **nothing to see** in the album is **not** told it exists.
- ✅ Publishing an album whose photos are **all still unpublished** notifies
      **nobody** (there is nothing for a family to see yet).
- ✅ Withdraw then re-publish an album → no duplicate notification (deduped on the
      album).

## 6. Preferences & resilience

- ✅ Account → **Notifications**: toggle the three categories → **Save** → reload →
      they stuck. (These gate the Phase 8 badge/push; the in-app bell always shows
      everything.)
- ✅ **Worker off** → publish → no notification; start the worker → it appears
      within seconds. Nothing lost.
- ✅ **No double-notify** on a worker retry (enforced by the unique dedupe key).

## 7. Security & audit

- 🔒 A parent sees only their **own** notifications; a tapped notification can only
      redirect to a path the app stored, never one supplied by the request.
- 🚫 A parent visiting `/admin/announcements` is bounced to `/portal`.
- ✅ Owner → **Activity** logs each announcement publish and album publish.
- 🔒 No notification or announcement leaks a photo a family may not see — fan-out
      uses the same routing rule as the photo pages.

## Not built (deliberately)

- **Pinned announcements** — the schema has a `pinnedUntil` field, unused. Say the
  word to add "pin to top".
- **Email / push** — Phase 8 (with the PWA). Phase 5 is in-app only.
