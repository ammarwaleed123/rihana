import type { Plural } from "../plural";

/**
 * English dictionary — the source of truth for the public site's copy.
 *
 * The shape of this object *is* the type every other locale must satisfy (see
 * ./ar.ts, which is typed `Dictionary`), so adding a key here immediately makes
 * the compiler demand the Arabic translation. That is deliberate: a missing
 * translation should be a build error, never a silent English string on an
 * Arabic page.
 *
 * Only public-marketing copy lives here for now. Portal and admin copy will be
 * added under their own top-level keys when those surfaces are localized.
 *
 * Text that is a *fact about the nursery* rather than a phrase — the address,
 * phone, opening hours, room names — is kept in ./content.ts instead, because it
 * is owner-supplied and mostly identical in both languages.
 */

const en = {
  meta: {
    /** Appended to page titles by the layout's title.template. */
    siteName: "Rihana Montessori Academy",
    tagline: "A warm nursery in Maadi, Cairo for ages 1–5",
  },

  nav: {
    ariaLabel: "Main",
    home: "Home",
    programs: "Programs",
    about: "About",
    aboutLong: "About us",
    visit: "Visit us",
    enquire: "Enquire",
    parentLogin: "Parent login",
    staffLogin: "Staff login",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    switchLanguage: "Language",
  },

  common: {
    bookVisit: "Book a visit",
    ourPrograms: "Our programs",
    findUs: "Find us",
    seeAllPrograms: "See all programs",
    getDirections: "Get directions",
  },

  footer: {
    blurb:
      "A warm, playful place for little ones to learn through play — with photos kept safely for family only.",
    explore: "Explore",
    families: "Families",
    visitHeading: "Visit",
    enquireAboutPlace: "Enquire about a place",
    rights: "Made with care.",
    privacyNote:
      "Photos of children are private and shared only with their families.",
  },

  home: {
    metaTitle: "A warm nursery in Maadi, Cairo for ages 1–5",
    metaDescription:
      "Rihana Montessori Academy is a warm, playful nursery in Maadi, Cairo, where children aged 1–5 are cared for by qualified educators — learning through play in small, happy groups with nutritious meals and safe, secure days.",

    hero: {
      badge: "Nursery in Maadi, Cairo · ages 1–5",
      title: "Where little ones love to learn",
      body:
        "A warm, playful nursery in the heart of Maadi — where your child is cared for, kept safe, and encouraged to explore something new every single day.",
      photoAlt:
        "An educator and children painting together at a bright nursery table",
      badgeQualified: "Qualified,\ncaring educators",
      badgeAges: "ages\n1–5",
    },

    facts: {
      ages: "Ages 1 to 5",
      qualified: "Qualified educators",
      smallGroups: "Small, happy groups",
      meals: "Fresh, healthy meals",
      safe: "Safe & secure",
      hours: "Sun–Thu, 8am–4pm",
    },

    care: {
      eyebrow: "Warm from the first hello",
      title: "A gentle place to be little",
      body:
        "Settling in is done at your child’s pace, with a familiar key person who learns their name, their comforts and their little ways — so mornings are full of smiles, not tears.",
      points: [
        "A familiar key person",
        "Gentle, unhurried settling-in",
        "A warm, predictable routine",
        "Cuddles and encouragement",
      ],
      photoAlt: "An educator helping two young children with a paper craft",
      sticker: "Kindness first ♥",
    },

    programs: {
      eyebrow: "A room for every age",
      title: "Three rooms, one happy family",
      body:
        "Your child grows through three age groups, each with its own gentle rhythm — and a familiar face who knows them by name.",
    },

    whyUs: {
      eyebrow: "Why families choose us",
      title: "Everything your child needs to thrive",
      points: [
        {
          title: "Qualified, caring staff",
          body: "Trained early-years educators who genuinely love what they do.",
        },
        {
          title: "Small groups",
          body: "Gentle group sizes, so every child is seen, heard and known.",
        },
        {
          title: "Nutritious meals",
          body: "Fresh, balanced meals and snacks prepared daily on site.",
        },
        {
          title: "Outdoor play",
          body: "Fresh air, garden play and messy fun, come rain or shine.",
        },
        {
          title: "Learning through play",
          body:
            "Art, music, stories and discovery — the way little ones learn best.",
        },
        {
          title: "Safe & secure",
          body: "Secure entry, trained-in-first-aid staff, and careful daily routines.",
        },
      ],
    },

    day: {
      eyebrow: "A day at Rihana",
      title: "Every day is full of good things",
      body:
        "Busy hands, curious minds and plenty of rest — here’s a peek at the kinds of things that fill a day.",
      tiles: [
        {
          label: "Move & groove",
          caption: "Dancing and active play",
          alt: "Children with arms raised, dancing in a playroom",
        },
        {
          label: "Creative play",
          caption: "Painting, gluing, making",
          alt: "Children painting with watercolours",
        },
        {
          label: "Story & language",
          caption: "Books, songs, new words",
          alt: "An educator reading a story to children",
        },
        {
          label: "Music & circle time",
          caption: "Bells, rhythm, singing",
          alt: "Children playing musical bells",
        },
        {
          label: "Imagine & pretend",
          caption: "Dress-up and role play",
          alt: "Children in costumes during imaginative play",
        },
        {
          label: "Calm & rest",
          caption: "Quiet time to recharge",
          alt: "Children sitting calmly on a mat",
        },
      ],
    },

    connected: {
      eyebrow: "For our families",
      title: "Peace of mind, every day",
      body:
        "Once your child joins us, you get a private family app: see their day in photos, know exactly who is allowed to collect them, and hear from us the moment there’s news.",
      pillPhotos: "Daily photos",
      pillPickup: "You choose who collects",
      pillUpdates: "Gentle updates",
      note:
        "Every photo is private — shared only with your own family, never on this public site.",
      phoneNotification: "2 new photos today",
    },

    testimonials: {
      eyebrow: "Loved by families",
      title: "Kind words from our parents",
    },

    visitCta: {
      title: "Come and see us for yourself",
      body:
        "The best way to know if Rihana is right for your family is to visit. We’d love to show you around.",
      steps: [
        {
          title: "Say hello",
          body: "Send a quick enquiry with a little about your child.",
        },
        {
          title: "Come and visit",
          body: "Look around, meet the team, and get a feel for the place.",
        },
        {
          title: "Join the family",
          body: "Settle in gently, at your child's own pace.",
        },
      ],
    },
  },

  about: {
    metaTitle: "About us",
    metaDescription:
      "Rihana Montessori Academy is a warm, family-run nursery in Maadi, Cairo, where children learn through play in a safe, caring environment with qualified educators.",
    eyebrow: "About Rihana",
    title: "A warm little world of our own",
    body1:
      "Rihana began with a simple wish: a nursery where children feel as safe and loved as they do at home. Today, in the heart of Maadi, our small team cares for little ones aged one to five — learning through play, growing in confidence, and making their very first friends.",
    body2:
      "We keep our groups small on purpose. It’s how we get to know every child — their comforts, their quirks and the things that make them light up.",
    photoAlt: "An educator giving warm, one-to-one attention to a child",

    values: {
      eyebrow: "What we believe",
      title: "The things that matter to us",
      items: [
        {
          title: "Kindness first",
          body: "Every child is met with warmth, patience and a gentle hand.",
        },
        {
          title: "Learning through play",
          body:
            "Play is how little ones make sense of the world — so we build the day around it.",
        },
        {
          title: "Small, close groups",
          body: "Gentle group sizes mean every child is truly known and seen.",
        },
        {
          title: "Safe and secure",
          body: "Careful routines, secure entry and staff trained in first aid.",
        },
        {
          title: "Happy mornings",
          body: "We settle every child gently, so drop-off is full of smiles.",
        },
        {
          title: "Curiosity encouraged",
          body: "Questions, mess and wonder are always welcome here.",
        },
      ],
    },

    safety: {
      eyebrow: "Safety & wellbeing",
      title: "Cared for, every moment",
      body:
        "Your child’s safety underpins everything we do — from who walks through the door to who walks back out with them.",
      points: [
        "Secure entry and careful sign-in",
        "Staff trained in paediatric first aid",
        "You decide exactly who may collect your child",
        "Photos shared privately with your family only",
      ],
      photoAlt: "Children sitting calmly together on a mat",
    },

    cta: {
      title: "We’d love to meet you",
      body: "The warmth of Rihana is best felt in person. Come and say hello.",
    },
  },

  programs: {
    metaTitle: "Our programs — ages 1 to 5",
    metaDescription:
      "Three age groups at Rihana Montessori Academy in Maadi: Sunflowers (1–2), Olives (2–4) and Cedars (4–5). Learning through play, in small, caring groups.",
    eyebrow: "Our programs",
    title: "A room for every age",
    body:
      "Your child grows through three groups, each with its own gentle rhythm and a familiar key person who knows them by name.",

    cta: {
      title: "Not sure which room is right?",
      body:
        "Come and visit — we’ll help you find the perfect fit for your child and answer every question.",
      aboutUs: "About us",
    },
  },

  visit: {
    metaTitle: "Visit us",
    metaDescription:
      "Find Rihana Montessori Academy in Maadi, Cairo. Opening hours, location, how to enrol, and answers to common questions. Come and visit — we'd love to show you around.",
    eyebrow: "Visit us",
    title: "Come and see us",
    body:
      "The best way to get a feel for Rihana is to visit. Here’s where to find us and how to get in touch.",

    findUs: "Find us",
    address: "Address",
    openingHours: "Opening hours",
    phone: "Phone",
    email: "Email",
    mapCaption: "A leafy, quiet corner of the city",

    faqEyebrow: "Good to know",
    faqTitle: "Questions parents often ask",

    cta: {
      title: "Ready to visit?",
      body: "Send a quick enquiry and we’ll arrange a time that suits you.",
    },
  },

  enquire: {
    metaTitle: "Enquire about a place",
    metaDescription:
      "Enquire about a place at Rihana Montessori Academy in Maadi, Cairo. Tell us a little about your child and we'll be in touch to arrange a visit.",
    eyebrow: "Admissions",
    title: "Let’s find your child a place",
    body:
      "Send us a little about your child and we’ll be in touch to answer your questions and arrange a warm welcome.",

    kindLegend: "What can we help with?",
    kindVisit: "Book a visit",
    kindQuestion: "Ask a question",

    parentName: "Your name",
    email: "Email",
    phone: "Phone",
    phoneHint: "Egyptian mobile, e.g. 01012345678. The quickest way for us to reach you.",
    childFirstName: "Child's first name (optional)",
    childDateOfBirth: "Child's date of birth (optional)",
    preferredStartDate: "Preferred start date (optional)",
    preferredStartHint: "Roughly when you'd like your child to start.",
    preferredVisit: "Preferred day & time to visit (optional)",
    preferredVisitHint: "Roughly when you'd like to come in — we'll confirm by phone.",
    preferredVisitPlaceholder: "e.g. weekday mornings, or Tuesday after 2pm",
    messageQuestion: "How can we help?",
    messageVisit: "Anything you'd like us to know? (optional)",
    messagePlaceholderVisit:
      "Any questions, or the best time for us to call — optional.",
    messagePlaceholderQuestion:
      "Ask us anything — your questions, your child's needs, the best time to call…",

    submitVisit: "Request a visit",
    submitQuestion: "Send enquiry",
    submitting: "Sending…",

    successTitle: "Message sent",
    backHome: "Back to home",

    privacyNote: "We only use your details to reply about a place at the nursery.",
    honeypotLabel: "Company (leave blank)",

    preferToTalk: "Prefer to talk?",
    preferToTalkBody: "We’re happy to chat any time during opening hours.",
    callUs: "Call us",
    visitUs: "Visit us",
    openLabel: "Open",
  },

  /* ──────────────────────────────────────────────── private app: admin ── */
  admin: {
    nav: {
      ariaLabel: "Admin sections",
      overview: "Overview",
      photos: "Photos",
      albums: "Albums",
      announcements: "Announcements",
      pickup: "Pickup",
      children: "Children",
      classes: "Classes",
      inquiries: "Inquiries",
      people: "Parents & staff",
      activity: "Activity",
      account: "Account",
    },

    roleOwner: "Owner",
    roleTeacher: "Teacher",

    children: {
      title: "Children",
      descOwner: "Everyone enrolled at the nursery.",
      descTeacher: "Children in the classes you are assigned to.",
      deleted: "{name}’s record was permanently deleted.",
      showing: "Showing",
      clearFilter: "clear filter",
      emptyTitle: "No children found",
      emptyFiltered: "Nothing matches those filters. Try clearing them.",
      emptyOwner: "Add your first child to get started.",
      emptyTeacher: "No children are enrolled in your classes yet.",
      colName: "Name",
      colClass: "Class",
      colGuardians: "Guardians",
      colPhotos: "Photos",
      colLeft: "Left",
      unassigned: "Unassigned",
      noneLinked: "None linked",
      consentGiven: "Consent given",
      noConsent: "No consent",
      consent: "Consent",
      manage: "Manage",
      loadMore: "Load more",
      age: "Age",
      ageMonths: "{n} mo",
      ageYears: "{n} yr",
      manageAria: "Manage {name}",
      photoConsentGiven: "Photo consent given",
      searchByName: "Search by name",
      searchPlaceholder: "Laila",
      allClasses: "All classes",
      filtering: "Filtering…",
      filter: "Filter",
      consentWarning:
        "Turning this off removes the child from every photo they are already tagged in, and stops them being tagged in new ones. Photos that showed only this child stop being visible to anyone, including their own family.",
    },

    classes: {
      title: "Classes",
      descOwner: "Each class groups children and the teachers who may see them.",
      descTeacher: "The classes you are assigned to.",
      teachers: "Teachers",
      addClass: "Add a class",
      className: "Class name",
      classNamePlaceholder: "Sunflowers",
      ageGroup: "Age group",
      academicYear: "Academic year",
      createClass: "Create class",
      assign: "Assign",
      archive: "Archive",
      allTeachersAssigned: "Every teacher is already assigned to this class.",
      addTeacher: "Add a teacher",
      remove: "Remove",
      teacherCount: { one: "{n} teacher", other: "{n} teachers" } as Plural,
      creating: "Creating…",
      assigning: "Assigning…",
      archiveAria: "Archive {name}",
      removeAria: "Remove {name} from this class",
      noTeacherAssigned:
        "No teacher assigned yet — nobody can upload photos for this class.",
      viewChildrenIn: "View children in {name}",
    },

    albums: {
      title: "Albums",
      description:
        "Group photos into a named album, like a graduation day. An album never shares a photo — families see only the pictures they could already see.",
      emptyTitle: "No albums yet",
      emptyBody:
        "Albums are a nice way to hand families a whole event at once — sports day, a trip, the last day of term.",
      createAlbum: "Create an album",
      needClass: "You need a class before you can make an album.",
      allAlbums: "All albums",
      published: "Published",
      draft: "Draft",
    },

    photos: {
      title: "Photos",
      description: "Upload photos, tag who is in them, then publish to families.",
      emptyTitle: "No uploads yet",
      emptyBody:
        "Upload your first batch of photos and tag who appears in each one.",
      deleted: "Photo deleted. The upload it emptied has been removed from the list.",
      newUpload: "New upload",
      recentUploads: "Recent uploads",
      published: "Published",
      notPublished: "Not published",
    },

    inquiryStatus: {
      NEW: "New", CONTACTED: "Contacted", TOURED: "Toured",
      ENROLLED: "Enrolled", CLOSED: "Closed",
    },

    inquiries: {
      title: "Inquiries",
      description:
        "Families who enquired through the website. Work each one along the pipeline as you follow up.",
      all: "All",
      emptyTitle: "No inquiries here",
      emptyBody:
        "When a family sends an enquiry from the website, it appears here for you to follow up.",
      kindVisit: "Visit request",
      kindQuestion: "Question",
      colFamily: "Family",
      colChild: "Child",
      colContact: "Contact",
      colStatus: "Status",
      colReceived: "Received",
      open: "Open",
      openInquiry: "Open inquiry",
      loadOlder: "Load older",

      allInquiries: "All inquiries",
      requestedVisitOn: "Requested a visit",
      enquiredOn: "Enquired",
      handledBy: "handled by {name}",
      updated: "Inquiry updated.",
      details: "Details",
      email: "Email",
      phone: "Phone",
      childDob: "Child's date of birth",
      preferredStart: "Preferred start",
      preferredVisit: "Preferred visit",
      theirMessage: "Their message",
      internalNotes: "Internal notes",
      statusTitle: "Status",
      statusHelp: "Move this family along as you follow up.",
      current: "current",
    },

    pickupBoard: {
      title: "Pickup board",
      description:
        "Who may collect each child today. Only approved people appear — anyone still awaiting approval is not shown.",
      emptyTitle: "No children to show",
      emptyBody:
        "There are no active children in view. Once children are enrolled, their pickup arrangements appear here.",
      classLabel: "Class",
      allClasses: "All classes",
      doorCollection: "Door collection",
      busNote: "Goes home on the nursery bus.",
      approvalsButton: "Approvals",
      busBadge: "Nursery bus",
      noClass: "No class",
      noApprovedPerson:
        "No approved pickup person yet — check with the office before releasing this child.",
      backToBoard: "Back to the pickup board",
      navAriaLabel: "Admin sections",
      show: "Show",
    },

    approvals: {
      title: "Pickup approvals",
      description:
        "People parents have asked to authorize for collecting their child. Approving one puts them on the pickup board; the parent is notified either way.",
      emptyTitle: "Nothing to review",
      emptyBody:
        "When a parent adds someone who may collect their child, the request appears here for you to approve.",
      relationship: "Relationship",
      phone: "Phone",
      child: "Child",
      requestedBy: "Requested by",
      requested: "Requested",
      onlyUntil: "Only until",
      shownToParent: "Shown to the parent",
      approvedToast: "Approved. They can now collect the child.",
      rejectedToast: "Turned down. The parent has been notified.",
      alreadyHandled: "That request had already been handled — nothing to do.",
      approve: "Approve",
      reasonOptional: "Reason (optional)",
      reject: "Reject",
    },


    home: {
      greeting: "Hello, {name}",
      ownerScope: "You have access to the whole nursery.",
      teacherScope: "You have access to the classes you are assigned to.",

      statChildren: "Children enrolled",
      statClasses: "Classes",
      statParents: "Parent accounts",
      statInvites: "Invitations pending",
      statYourClasses: "Your classes",
      statChildrenInYourClasses: "Children in your classes",

      unlinkedTitle: {
        one: "{n} child has no guardian linked",
        other: "{n} children have no guardian linked",
      } as Plural,
      unlinkedBody: "Nobody receives their photos.",
      reviewChildren: "Review children",

      newInquiriesTitle: {
        one: "{n} new enquiry from the website",
        other: "{n} new enquiries from the website",
      } as Plural,
      newInquiriesBody: {
        one: "A family is waiting to hear back.",
        other: "Families are waiting to hear back.",
      } as Plural,
      openInquiries: "Open inquiries",

      photosTitle: "Photos",
      photosBody: "Upload, tag and publish photos for families.",
      goToPhotos: "Go to photos",

      pickupTitle: "Pickup",
      pickupWaiting: {
        one: "{n} pickup request is waiting for your approval.",
        other: "{n} pickup requests are waiting for your approval.",
      } as Plural,
      pickupNothing: "Nothing waiting for approval right now.",
      reviewApprovals: "Review approvals",
      pickupBoard: "Pickup board",
      teacherPickupBody: "See who may collect each child in your classes today.",
      openPickupBoard: "Open the pickup board",
    },
  },

  /* ─────────────────────────────────────────────── private app: the portal ── */
  portal: {
    nav: {
      ariaLabel: "Portal sections",
      home: "Home",
      photos: "Photos",
      albums: "Albums",
      pickup: "Pickup",
      account: "Account",
    },

    common: {
      seeAll: "See all",
      manage: "Manage",
      /*
       * Annotated as `Plural` rather than left to inference: English needs only
       * `one` and `other`, but the type has to admit the `zero`/`two`/`few`/
       * `many` forms Arabic uses, or ar.ts cannot supply them.
       */
      photoCount: { one: "{n} photo", other: "{n} photos" } as Plural,
      back: "Back",
      loadOlder: "Load older",
    },

    home: {
      metaTitle: "Your dashboard",
      // {name} is the parent's own name.
      greeting: "Hello, {name}",
      // {children} is a locale-joined list, e.g. "Sara and Omar".
      subtitleWithChildren: "Photos and updates for {children}.",
      subtitleNoChildren: "Your child's photos and updates will appear here.",

      latestPhotos: "Latest photos",
      noPhotosTitle: "No photos yet",
      noPhotosBody: "When the nursery shares photos of {children}, they will appear here.",
      noPhotosBodyFallback:
        "When the nursery shares photos of your child, they will appear here.",

      albums: "Albums",

      announcements: "Announcements",
      latestPrefix: "Latest: {title}",
      noAnnouncements: "News and reminders from the nursery will appear here.",

      pickup: "Pickup",
      pickupBodyOne: "Choose who can collect your child — or set the nursery bus.",
      pickupBodyMany: "Choose who can collect your children — or set the nursery bus.",
    },

    photos: {
      metaTitle: "Photos",
      title: "Photos",
      description: "Photos of your children, and pictures shared with their class.",
      filterByChild: "Filter by child",
      everyone: "Everyone",
      emptyTitle: "No photos yet",
      emptyBody:
        "When the nursery shares photos of your child, they will appear here.",
      // {page}/{pageCount} are numbers, {count} is an already-pluralised phrase.
      pageSummary: "Page {page} of {pageCount} · {count}",
    },

    albums: {
      metaTitle: "Albums",
      title: "Albums",
      description:
        "Collections the nursery has put together, like a sports day or a school trip.",
      emptyTitle: "No albums yet",
      emptyBody:
        "When the nursery groups photos into an album, it will appear here.",
      albumCount: { one: "{n} album", other: "{n} albums" } as Plural,
      allAlbums: "All albums",
      pageOf: "Page {page} of {pageCount}",
    },

    announcements: {
      metaTitle: "Announcements",
      title: "Announcements",
      description: "News and reminders from the nursery.",
      emptyTitle: "Nothing right now",
      emptyBody: "When the nursery posts news for you, it will appear here.",
    },

    notifications: {
      metaTitle: "Notifications",
      title: "Notifications",
      description: "New photos and updates from the nursery.",
      markAllRead: "Mark all as read",
      emptyTitle: "Nothing yet",
      emptyBody:
        "When the nursery shares new photos or an announcement, it will show up here.",
    },

    pickup: {
      metaTitle: "Pickup",
      title: "Pickup",
      description:
        "Say who may collect each of your children — or that they ride the nursery bus. Everyone you add is checked by the nursery before they can collect.",
      emptyTitle: "No children linked yet",
      emptyBody:
        "When the nursery links a child to your account, you can set up who may collect them here.",
      noClass: "No class",
      ridesBus: "Rides the nursery bus",
      approvedCount: { one: "{n} approved", other: "{n} approved" } as Plural,
      pendingCount: {
        one: "{n} awaiting approval",
        other: "{n} awaiting approval",
      } as Plural,
      noneYet: "No one added yet",
    },

    pager: {
      ariaLabel: "Pagination",
      previous: "Previous page",
      next: "Next page",
      prevShort: "Prev",
      nextShort: "Next",
      pageN: "Page {n}",
    },

    signOut: {
      label: "Sign out",
      pending: "Signing out…",
    },

    photo: {
      metaTitle: "Photo",
      back: "Back",
      // {names} is a locale-joined list of the family's own tagged children.
      altOf: "Photo of {names}",
      altClass: "Class photo",
      loadMorePhotos: "Load more photos",
      download: "Download photo",
      downloading: "Saving…",
      savedDevice: "Saved to your device.",
      savedGallery: "Saved to your gallery.",
      chooseSaveImage: "Choose “Save Image” to add it to your Photos.",
      saveFailed: "Couldn't save the photo. Please try again.",
    },

    pickupChild: {
      allChildren: "All children",
      pickupLabel: "Pickup",
      addedAlert:
        "Sent to the nursery for approval. You’ll be notified when it’s reviewed.",
      updatedAlert: "Saved and sent back to the nursery for approval.",

      goingHome: "Going home",
      busTitle: "Nursery bus",
      busBody:
        "{name} goes home on the nursery bus, so no door pickup people are needed. Switch to “collected at the door” above if that changes.",
      busSavedNote:
        "You have {count} saved. They’ll apply again if you switch back to door collection.",
      savedPeopleCount: {
        one: "{n} pickup person",
        other: "{n} pickup people",
      } as Plural,

      whoCanCollect: "Who can collect {name}",
      noneAdded:
        "No one has been added yet. Add the people allowed to collect {name} below.",
      addSomeone: "Add someone",

      edit: "Edit",
      remove: "Remove",
      allowedUntil: "Allowed until",
      wasAllowedUntil: "Was allowed until",
      reason: "Reason: {reason}",
    },

    forms: {
      // Contact details
      yourName: "Your name",
      phone: "Phone",
      phoneHint:
        "Egyptian mobile, e.g. 01012345678. Used by the nursery to reach you. Optional.",
      saveDetails: "Save details",
      saving: "Saving…",

      // Password
      currentPassword: "Current password",
      newPassword: "New password",
      newPasswordHint:
        "At least {min} characters. A short phrase you will remember works well.",
      confirmNewPassword: "Confirm new password",
      changePassword: "Change password",
      changing: "Changing…",
      passwordSignsOutNote:
        "Changing your password signs out every other device using this account.",

      // Notification preferences
      prefsIntro:
        "Choose what you’re notified about. These apply to the phone notifications that arrive once you add the app to your home screen — the in-app bell always shows everything.",
      prefNewPhotos: "New photos of my child",
      prefAnnouncements: "Announcements from the nursery",
      prefPickup: "Pickup authorisation updates",
      savePreferences: "Save preferences",
    },

    install: {
      installed: "Installed on this device",
      iosHint: "On iPhone or iPad: tap the Share button",
      iosAddToHome: "Add to Home Screen",
      installApp: "Install app",
      menuHintBefore: "To install, open your browser menu and choose",
      menuHintStrong: "Install Rihana…",
      menuHintAfter: "(under “Cast, save, and share” in Chrome).",
    },

    bell: {
      label: "Notifications",
      labelUnread: "Notifications, {n} unread",
    },

    push: {
      checking: "Checking notifications…",
      justAMoment: "Just a moment…",
      turnOff: "Turn off on this device",
      turnOn: "Turn on notifications",
      onDescription:
        "On for this device — you’ll get a push for new photos, announcements and pickup updates.",
      offDescription: "Get a push on this device when something new arrives.",
    },

    relationship: {
      MOTHER: "Mother",
      FATHER: "Father",
      GUARDIAN: "Guardian",
      OTHER: "Other",
    },

    pickupStatus: {
      expired: "Expired",
      approved: "Approved",
      pending: "Awaiting approval",
      rejected: "Not approved",
      revoked: "Removed",
    },

    pickupForm: {
      relationshipSuggestions: [
        "Grandmother", "Grandfather", "Aunt", "Uncle",
        "Sibling", "Family friend", "Nanny", "Neighbour",
      ],

      fullName: "Full name",
      fullNamePlaceholder: "e.g. Fatima Saeed",
      relationship: "Relationship to the child",
      relationshipHint:
        "How they know the child — grandmother, family friend, and so on.",
      phone: "Phone number",
      phoneHint:
        "Egyptian mobile, e.g. 01012345678. Staff may call to confirm at the door.",
      expires: "Only allowed until (optional)",
      expiresHint:
        "Leave blank for an ongoing arrangement. Set a date for a one-off, e.g. a grandparent visiting this week.",
      photo: "Photo (optional)",
      photoHint:
        "A clear photo of their face helps staff recognise them at the door.",

      confirmPassword: "Confirm your password",
      confirmPasswordHint:
        "For your child's safety, changes to who can collect them need your password.",

      sendForApproval: "Send for approval",
      sending: "Sending…",
      saveChanges: "Save changes",
      saving: "Saving…",

      methodLegend: "How does this child go home?",
      methodHandover: "Collected at the door",
      methodHandoverDesc: "Collected by you or someone you've had approved.",
      methodBus: "Nursery bus",
      methodBusDesc: "Goes home on the nursery bus. No door pickup people needed.",
      saveArrangement: "Save arrangement",
      reviewNote:
        "The nursery reviews everyone you add before they can collect your child.",
      editResubmitNote:
        "Editing sends this person back to the nursery for approval again.",
      editTitle: "Edit pickup person",
      editBackTo: "Back to {name}",
      editFor: "For {name}",
    },

    account: {
      title: "Your account",
      descriptionParent: "Your details, your children, and your sign-in settings.",
      descriptionStaff: "Your details, your language, and your sign-in settings.",

      childrenTitle: "Your children",
      noChildren:
        "No children are linked to your account yet. Please contact the nursery.",
      childClass: "Class",
      classUnassigned: "Not assigned",
      childBorn: "Born",
      youAre: "You are",
      childPhotos: "Photos",
      photosShared: "Shared with you",
      photosWithdrawn: "Not shared — photo consent has been withdrawn",
      recordsNote:
        "To change a class, a name, or whether photos of your child may be shared, please contact the nursery. They keep these records.",

      detailsTitle: "Your details",

      emailTitle: "Email address",
      emailNoteParent:
        "This is the address you sign in with. It is set by the nursery — if it is wrong, please contact them and they will correct it.",
      emailNoteStaff: "This is the address you sign in with.",

      notificationsTitle: "Notifications",
      installApp: "Install the app",
      onThisDevice: "On this device",
      emailLabel: "Email",

      passwordTitle: "Password",

      languageTitle: "Language",
      languageLegend: "Choose the language for the app",
      languageSave: "Save language",
      languageSaving: "Saving…",
      signOutTitle: "Sign out",
      signOutBody:
        "Sign out of your account on this device. You will need your email and password to sign back in.",
    },
  },
};

/**
 * The shape every locale must provide.
 *
 * Deliberately *not* `as const`: literal types here would force the Arabic file
 * to repeat the English strings verbatim to typecheck. Widened to `string`, the
 * type still enforces that every key and every array entry exists.
 */
export type Dictionary = typeof en;

export default en;
