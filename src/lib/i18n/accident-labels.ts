import type {
  ACCIDENT_PLACES,
  BODY_PARTS,
  INJURY_NATURES,
  INJURY_TREATMENTS,
} from "@/lib/validation";

/**
 * Enum-to-wording maps for the accident report.
 *
 * In their own module because both sides need them: the teacher's form (a
 * client component) and the screens that render a finished record (server
 * components), which cannot call a function exported from a "use client" file.
 *
 * Explicit object literals rather than keys built from template strings, so a
 * renamed dictionary entry is a build error instead of a blank chip on a
 * screen nobody looks at twice.
 *
 * Each takes the section of the dictionary it belongs to — `admin.accidents`
 * or `portal.accidents` — because staff and families are given different
 * wordings for the same enum, and the two must be free to diverge.
 */

type PlaceStrings = {
  placeMontessoriClass: string;
  placeArtClass: string;
  placeToilet: string;
  placeGarden: string;
  placeDramaClass: string;
  placeAcademicClass: string;
  placeOther: string;
};

export function placeLabel(
  t: PlaceStrings,
  value: (typeof ACCIDENT_PLACES)[number],
): string {
  return {
    MONTESSORI_CLASS: t.placeMontessoriClass,
    ART_CLASS: t.placeArtClass,
    TOILET: t.placeToilet,
    GARDEN: t.placeGarden,
    DRAMA_CLASS: t.placeDramaClass,
    ACADEMIC_CLASS: t.placeAcademicClass,
    OTHER: t.placeOther,
  }[value];
}

type PartStrings = {
  partForehead: string;
  partEyebrow: string;
  partEye: string;
  partEar: string;
  partCheek: string;
  partNose: string;
  partMouth: string;
  partLip: string;
  partTooth: string;
  partTongue: string;
  partChin: string;
  partNeck: string;
  partChest: string;
  partArm: string;
  partHand: string;
  partStomach: string;
  partKnee: string;
  partLeg: string;
  partFoot: string;
  partToe: string;
};

export function partLabel(
  t: PartStrings,
  value: (typeof BODY_PARTS)[number],
): string {
  return {
    FOREHEAD: t.partForehead,
    EYEBROW: t.partEyebrow,
    EYE: t.partEye,
    EAR: t.partEar,
    CHEEK: t.partCheek,
    NOSE: t.partNose,
    MOUTH: t.partMouth,
    LIP: t.partLip,
    TOOTH: t.partTooth,
    TONGUE: t.partTongue,
    CHIN: t.partChin,
    NECK: t.partNeck,
    CHEST: t.partChest,
    ARM: t.partArm,
    HAND: t.partHand,
    STOMACH: t.partStomach,
    KNEE: t.partKnee,
    LEG: t.partLeg,
    FOOT: t.partFoot,
    TOE: t.partToe,
  }[value];
}

type NatureStrings = {
  natureBite: string;
  natureScratch: string;
  natureAnkleSprain: string;
  natureRedMark: string;
  natureBruises: string;
  natureCut: string;
  natureHitting: string;
  natureScratchArtificialGrass: string;
  natureOther: string;
};

export function natureLabel(
  t: NatureStrings,
  value: (typeof INJURY_NATURES)[number],
): string {
  return {
    BITE: t.natureBite,
    SCRATCH: t.natureScratch,
    ANKLE_SPRAIN: t.natureAnkleSprain,
    RED_MARK: t.natureRedMark,
    BRUISES: t.natureBruises,
    CUT: t.natureCut,
    HITTING: t.natureHitting,
    SCRATCH_ARTIFICIAL_GRASS: t.natureScratchArtificialGrass,
    OTHER: t.natureOther,
  }[value];
}

type TreatmentStrings = {
  treatmentIce: string;
  treatmentBetadine: string;
  treatmentRunningWater: string;
  treatmentBandage: string;
  treatmentHemoclar: string;
  treatmentOther: string;
};

export function treatmentLabel(
  t: TreatmentStrings,
  value: (typeof INJURY_TREATMENTS)[number],
): string {
  return {
    ICE: t.treatmentIce,
    BETADINE: t.treatmentBetadine,
    RUNNING_WATER: t.treatmentRunningWater,
    BANDAGE: t.treatmentBandage,
    HEMOCLAR: t.treatmentHemoclar,
    OTHER: t.treatmentOther,
  }[value];
}
