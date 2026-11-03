// Browser-safe report labels and defaults. Keep database and OTP modules out of the UI.
export const DEFAULT_TOLERANCE = Object.freeze({
  kmTolerance: 2,
  hourTolerance: 0.5,
});
export const CLASS_LABELS = {
  match: "Match",
  tolerance: "Within tolerance",
  negative: "Below previous closing",
  jump: "Jump above tolerance",
  "no-previous": "No previous card",
  "no-reading": "Reading missing",
};
