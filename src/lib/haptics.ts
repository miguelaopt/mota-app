/**
 * Toque curto de feedback. Android: Vibration API. iPhone (Safari 18+, onde
 * não há vibrate): clicar num <input type="checkbox" switch> dá um haptic.
 * Noutros casos não faz nada.
 */
export function haptic(enabled = true) {
  if (!enabled || typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
      return;
    }
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    label.style.display = "none";
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Feedback é opcional.
  }
}
