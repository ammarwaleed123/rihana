# Phase 4 — manual test checklist

Albums, the parent portal, and account self-service.

Everything below is covered by automated tests too (`e2e/albums.spec.ts`,
`e2e/account.spec.ts`, `tests/pagination.test.ts`). This list is for the things a
person notices and a test does not: whether the wording makes sense, whether a
phone is comfortable to use, whether the flow feels finished.

**Before you start**

```bash
npm run queue:warm     # once, on a fresh database
npm run dev
npm run worker         # second terminal — without this, photos never get thumbnails
```

Sign-ins: everyone uses `ChangeMe!Local123`.

| Role | Email |
|---|---|
| Owner | `owner@rihana.test` |
| Teacher (Sunflowers) | `teacher.sun@rihana.test` |
| Teacher (Olives) | `teacher.olive@rihana.test` |
| Parent — Laila (Sunflowers) + Omar (Olives) | `amal@rihana.test` |
| Parent — Zayn (Sunflowers) | `khalid@rihana.test` |

---

## 1. The fix that matters most: pagination

This is the Phase 3 bug this phase opens with. A parent's album applied the
routing rule on page 1 and then returned **every published photo in the nursery**
from page 2 onward. It needs more than 24 photos to show itself.

- [ ] As the owner, upload **25 or more** photos into Olives and tag them with Hana
      (Nour's child). Publish.
- [ ] Sign in as **Khalid**, whose child Zayn is in Sunflowers and who should see
      none of them.
- [ ] Go to Photos. Scroll to the bottom and press **Load more photos**.
- [ ] **Nothing from Olives appears, on any page.** Before the fix, page 2 showed
      the lot.
- [ ] Repeat as Amal, who has a child in each class: every page shows only her own
      children's photos and Sunflowers/Olives class albums.

---

## 2. Albums never widen access

The core rule: putting a photo in an album does not share it.

**As the owner**

- [ ] Photos → upload two photos into Sunflowers. Caption them so you can tell
      them apart. Tag one with **Laila only**; mark the other **Share with the
      whole class**. Publish both.
- [ ] Albums → **New album** → title it, choose Sunflowers, **Create album**.
- [ ] You land on the album. The picker below shows photos you can add, each with
      its caption or date underneath.
- [ ] Tick both photos → **Add 2 photos**. The confirmation appears even though
      the picker empties.
- [ ] **Publish album.**

**As Amal** (Laila is tagged in one, and is in the class for the other)

- [ ] Albums → the album is listed, showing **2 photos**.
- [ ] Open it. Both photos are there.

**As Khalid** (Zayn is in the same class, but is not in Laila's photo)

- [ ] Albums → the same album is listed, showing **1 photo** — not 2. The count is
      what *he* can see; the real size would tell him a photo of another child is
      in there.
- [ ] Open it. Only the class photo. **Laila's photo is not there**, even though it
      is in this album.

---

## 3. An album that is empty for you does not exist

- [ ] As the owner, create a second album containing **only Laila's tagged photo**.
      Publish it.
- [ ] As Khalid, go to Albums. **It is not listed.**
- [ ] Copy the album's id from the owner's URL and visit
      `/portal/albums/<that-id>` as Khalid. You get **404**, not "forbidden" — a
      403 would confirm the album exists and hint at what is in it.

---

## 4. Covers

- [ ] As the owner, open the first album and press **Make cover** on Laila's photo.
- [ ] As Amal: the album card shows Laila's photo as the cover.
- [ ] As Khalid: the card shows **the class photo instead** — he gets the first
      cover he is allowed to see, never a blank tile and never Laila.

---

## 5. Withdrawing and deleting an album

- [ ] As the owner, open the album → **Withdraw album**.
- [ ] As Amal: the album is gone from Albums, but **both photos are still in
      Photos**. Withdrawing an album never hides a photo.
- [ ] As the owner, publish it again, then delete it: type the album's title
      exactly, then **Delete this album**.
- [ ] As Amal: **the photos are all still there.** Deleting an album removes the
      grouping only.

---

## 6. Albums and unpublished photos

The most confusing thing about this feature, so check the wording earns its place.

- [ ] As the owner, upload a photo into Sunflowers, tag it, but **do not publish**.
- [ ] Add it to an album. The tile shows **"Not shared yet"**, and the album says
      how many of its photos have not been shared.
- [ ] Publish the album. The confirmation says nobody can see those photos yet, and
      tells you to publish them from the Photos page.
- [ ] Publish the photo from Photos. Return to the album as a parent — it appears.

---

## 7. Teachers stay in their own classes

- [ ] As **teacher.olive**, go to Albums. The Sunflowers albums are **not listed**.
- [ ] Paste a Sunflowers album URL. **404.**
- [ ] Press **New album**. The Class list offers **Olives only** — there is no
      "Whole nursery" option, because a nursery-wide album reaches every class.
- [ ] Create an Olives album, add a photo, publish. This works.
- [ ] Try to move it to Sunflowers via Album details — the option is not there.

---

## 8. The parent portal on a phone

Open the browser dev tools and switch to a phone viewport, or use a real phone.

- [ ] There is a **tab bar along the bottom**: Home, Photos, Albums, Account.
- [ ] Exactly one tab is highlighted at a time. Moving between tabs moves the
      highlight — it does not light up two.
- [ ] Nothing is hidden behind the tab bar. Scroll to the bottom of a long photo
      list: the **Load more photos** button is fully reachable.
- [ ] Tapping targets are comfortable one-handed.
- [ ] On a desktop width, the tab bar is gone and the same links sit in the header.

---

## 9. Photos and albums for a parent

- [ ] As Amal (two children), Photos shows chips: **Everyone / Laila / Omar**.
- [ ] Tap **Laila**: her tagged photos *and* Sunflowers class albums. A class photo
      is a photo of her too.
- [ ] Open a photo. The caption, the children's names, and the date are shown.
- [ ] The names shown are **only her own children** — never a classmate's.
- [ ] Press **Download photo**. You get a saved file, not a full-screen image. Try
      this on a phone too.
- [ ] Open a photo from inside an album, then press **← Back**. You return to the
      album, not to the top of Photos.

---

## 10. Account self-service

Use a parent account you are willing to change. Invite a fresh one from
Admin → Parents & staff if you would rather not touch a seeded account.

**Details**

- [ ] Portal → Account. Your children are listed with class, date of birth, your
      relationship, and whether photos are shared.
- [ ] Change your name and a valid phone (`01012345678`) → **Save details** →
      reload. It stuck.
- [ ] Enter `00000000000`, or a landline like `0223456789`, or letters → refused
      with "valid Egyptian mobile". Formats like `+20 100 000 0000`,
      `010 1234 5678` are accepted and normalised to `01…`.

**Email**

- [ ] The email is shown **read-only** — there is no field to edit it and no
      "Change email" button. It says the nursery sets it. (A parent changing
      their own email would be able to redirect their own password reset.)

**Password**

- [ ] Enter the **wrong** current password → "That is not your current password",
      and nothing changes (your old password still signs you in).
- [ ] Mistype the confirmation → "Those passwords do not match".
- [ ] Try to set your **current** password as the new one → refused.
- [ ] Change it properly. You stay signed in on this device — you are not dumped
      back at the sign-in screen for having changed your password.
- [ ] Sign in on a second browser first, then change the password in the first.
      The second browser is **signed out** on its next page load.
- [ ] The old password no longer works. The new one does.

---

## 11. Stranded photos recover on their own

Phase 4 fixed a photo that could sit invisible forever if its processing job was
lost. It self-heals within about five minutes.

- [ ] Stop the worker (`Ctrl-C` in its terminal).
- [ ] Upload and publish a photo. The tagging screen shows it as **Processing**,
      and it is not visible to families.
- [ ] Start the worker again. Wait for the maintenance sweep (up to 5 minutes).
- [ ] The photo becomes visible without anyone re-uploading it. The worker log
      says `re-enqueued photos stuck in PROCESSING`.

---

## 12. Audit trail

- [ ] As the owner, Activity shows entries for creating and publishing albums and
      for password changes.
- [ ] No entry anywhere contains a password, a token, or a signed URL.
