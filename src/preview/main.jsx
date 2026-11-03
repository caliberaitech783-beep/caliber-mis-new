import { createPreviewApi } from "./api.mjs";
import { session } from "./fixtures.mjs";
import "./preview.css";
if (
  !import.meta.env.DEV ||
  import.meta.env.MODE !== "preview" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
)
  throw Error("Synthetic preview requires local:preview on loopback.");
const key = "caliber:synthetic-preview:v1";
let initialState;
try {
  initialState = JSON.parse(sessionStorage.getItem(key) || "null") || undefined;
} catch {}
window.fetch = createPreviewApi({
  initialState,
  save: (state) => sessionStorage.setItem(key, JSON.stringify(state)),
});
// A separate localhost port and explicit preview session keep real sign-in out of this entry.
localStorage.removeItem("nerveCenterSession");
sessionStorage.setItem("nerveCenterSession", JSON.stringify(session));
const notice = document.getElementById("preview-notice");
notice.innerHTML =
  '<strong>LOCAL MOCK · Synthetic data</strong><span>Changes stay in this browser tab. No production authentication, OCR, backup or synchronization.</span><button type="button">Reset demo data</button>';
notice.querySelector("button").addEventListener("click", () => {
  sessionStorage.removeItem(key);
  location.reload();
});
const measure = () =>
  document.documentElement.style.setProperty(
    "--preview-height",
    notice.offsetHeight + "px",
  );
new ResizeObserver(measure).observe(notice);
measure();
// Service credentials are never accepted in the mock environment.
const disableCredentialForms = () => {
  for (const input of document.querySelectorAll('input[type="password"]')) {
    input.disabled = true;
    input.placeholder = "Unavailable in synthetic preview";
    const form = input.closest("form");
    if (form)
      for (const control of form.querySelectorAll(
        'input,button[type="submit"],button:not([type])',
      ))
        control.disabled = true;
  }
};
new MutationObserver(disableCredentialForms).observe(
  document.getElementById("root"),
  { childList: true, subtree: true },
);
await import("../main.jsx");
