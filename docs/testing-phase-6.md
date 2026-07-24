# Phase 6 — manual test checklist

Pickup authorization: who may collect each child, the nursery-bus choice, owner
approval, and the day-of door board. This is the safety-critical phase — the two
gates that matter are **owner approval** and **password re-entry**.

**The worker must be running**, because the approve/reject notifications fan out
off the request (same as Phases 3–5):

```bash
npm run worker          # its own terminal
npm run dev             # http://localhost:3120
```

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

**Seeded starting state** (so there's something to see):

- **Omar** rides the **nursery bus**.
- **Laila**: **Fatima Saeed** (grandmother) *approved*; **Rana Saeed** (aunt)
  *awaiting approval*.
- **Zayn**: **Hoda Kamal** (family friend) *awaiting approval*.
- **Tariq**: **Sherif Darwish** (uncle) *approved*.

So the owner's approval queue starts with **two** requests, and the board starts
with two approved people, one bus rider, and several children with nobody added.

Legend: ✅ works · 🚫 refused · 🔒 security-critical.

---

## 1. Parent — adding people (Portal → Pickup)

- ✅ **Amal** opens **Pickup**: sees Laila and Omar. Omar shows "🚌 Rides the
      nursery bus"; Laila shows "1 approved · 1 awaiting approval".
- ✅ Open **Laila** → **Add someone**: fill a name, relationship, phone → **Confirm
      your password** → **Send for approval**. Lands back on Laila with a success
      banner; the person shows **Awaiting approval**.
- 🔒 **Wrong password** on add → "That is not your current password"; nothing is
      added.
- 🔒 **Blank password** → "Enter your password to confirm"; nothing is added.
- ✅ **Phone validation:** a string of zeros or a 5-digit number is refused; a
      pasted `+20 100 123 4567` is accepted and stored as `01001234567`.
- ✅ **Relationship** accepts free text (the suggestions list is only a helper).
- ✅ **Photo (optional):** attach a JPEG/PNG/HEIC → after approval it shows on the
      board and the queue. A non-image file (e.g. a PDF) is refused with a clear
      message and **nothing is added**.
- ✅ **Time-boxed:** set "Only allowed until" to a future date → saves. A **past**
      date is refused.
- ✅ **Edit** a person → it returns to **Awaiting approval** (editing re-opens
      review). The current photo is shown with "choose a new file to replace it".
- ✅ **Remove** a person → it disappears from the list immediately (no password
      needed — removing only reduces access).

## 2. Parent — the bus choice

- ✅ On a **door-collection** child, under **Going home**, choose **Nursery bus** →
      **Confirm your password** → **Save arrangement**. The people section is
      replaced by a bus notice; any saved people are kept for if you switch back.
- ✅ Switch **back** to **Collected at the door** (re-auth) → the people list and
      **Add someone** return, with the previously-added people intact.
- 🔒 Changing the arrangement with the **wrong password** changes nothing.

## 3. Owner — the approval queue (Admin → Pickup → Approvals)

- ✅ The queue lists every awaiting request **oldest first**, with photo, name,
      relationship, phone, which child, who asked, and when.
- ✅ **Approve** → banner "They can now collect the child"; the request leaves the
      queue and the person appears on the **board**.
- ✅ **Reject** with a **reason** → banner "The parent has been notified"; the
      request leaves the queue.
- ✅ **Reject** with **no reason** is allowed (the parent gets a generic "contact
      the nursery").
- ✅ A request whose **end date has already passed** is flagged amber in the queue
      ("check with the parent before approving").
- ✅ **Double-handle:** approve a request in one tab, then approve the same one in a
      stale second tab → the second says "already been handled", not a second
      approval.
- ✅ The **Overview** card and the **Approvals** button both show the pending count;
      it drops as you clear the queue.

## 4. Staff — the door board (Admin → Pickup)

- ✅ Each active child shows either **🚌 Nursery bus**, or their **approved,
      non-expired** people with photo, relationship and phone.
- 🔒 A **door-collection child with nobody approved** shows a **red** warning —
      "check with the office before releasing this child".
- 🔒 **Pending people never appear** on the board — only approved ones.
- ✅ An **expired** authorization drops off the board on its own (no one has to
      remove it).
- ✅ **Owner** sees every class; the **class filter** narrows the view.
- 🚫 **teacher.sun** sees **only Sunflowers** children on the board; **no Olives**
      child appears, and there is **no Approvals button** for a teacher.
- 🚫 **teacher.olive** sees only Olives.

## 5. Notifications (worker running)

- ✅ When a parent adds a person, the **owner** gets a "Pickup approval needed"
      notification on the **bell in the admin header** (→ `/admin/notifications`),
      which tapping opens the approvals queue.
- ✅ On **approve**, the **requesting parent** gets "Pickup authorized"; tapping it
      opens the pickup page.
- ✅ On **reject**, the parent gets "Pickup not approved" with the reason (if given).
- ✅ **Editing** an approved person (which re-opens review) notifies the owners
      again, and a fresh approval notifies the parent again — not deduped away.
- ✅ **Worker off** → approve → no notification; start the worker → it arrives within
      seconds. Nothing is lost. No double-notify on a retry.

## 6. Security & scope

- 🔒 **Amal cannot reach Khalid's child.** Visiting `/portal/pickup/<Zayn's id>`
      is a 404 (not Amal's child), and Zayn never appears in Amal's list.
- 🔒 A **parent** visiting `/admin/pickup` or `/admin/pickup/approvals` is bounced
      to the portal.
- 🔒 A **teacher** visiting `/admin/pickup/approvals` is bounced (owner-only); the
      board itself is fine for staff.
- 🔒 **Pickup photo is gated:** `/api/img/pickup/<id>` returns the image only to
      someone who may see that child; signed-out or wrong-family requests get a
      **404**, never a 403. Copying a board image URL and opening it signed-out
      fails.
- 🔒 A **co-guardian** (Nour, on Tariq) can see and manage Tariq's pickup people —
      guardianship, not "who added it", is the edge.

## 7. Audit (Admin → Activity, owner)

- ✅ Each of **add / edit / remove / approve / reject / bus-or-door change** writes a
      row naming who did it and to which child.
- 🔒 A **failed password re-entry** on a pickup change is logged too.

## Not built (deliberately)

- **Owner-set bus routes / bus rosters** — the bus is a single yes/no per child.
  Route management (which bus, which stops) is out of scope for this phase.
- **Owner override of a child's method** — the arrangement is parent-set (with
  re-auth); the owner sees it read-only on the board. Say the word to add an
  owner-side, audited override.
- **Push / lock-screen alerts** — Phase 8 (with the PWA). Phase 6 is the in-app
  bell, as with Phase 5.
