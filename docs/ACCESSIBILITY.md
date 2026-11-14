# TERRA accessibility

TERRA's scientific workflow is designed to work without sound, free-form typing, or map interaction. These are implemented aids, not a claim of complete WCAG 2.2 AA conformance; keyboard and assistive-technology review is still needed.

## Current support

- **No hearing required:** the application has no essential audio alerts. Data loading, failures, trend direction, and significance are shown as text; live status messages use accessible status/alert regions.
- **Typing is optional for the main analysis:** variable choices, example locations, and preset time periods are selectable controls. The free-form research question is optional. It may be typed or entered using the browser's speech-recognition feature in English or Urdu.
- **Speech privacy:** TERRA requests microphone input only after the user activates voice entry. Browser speech recognition may send audio to a browser/vendor speech service. The question itself stays in the page and is not sent to the analysis API; it is used for a local keyword suggestion and is included in a CSV only when the user explicitly downloads it. An operating-system dictation feature is an alternative when browser recognition is unavailable.
- **Blind and low-vision access:** semantic headings, labels, landmarks, visible keyboard focus, a skip link, accessible chart navigation where supported by Recharts, and an exact-value HTML table are provided. The Earth map has a table-based analysis alternative.
- **Motor access:** navigation and analysis controls use native links, buttons, select lists, radio buttons, checkboxes, and forms; the mobile menu supports Escape and moves focus when opened or when the route changes.
- **Visual and cognitive access:** users can enable larger text, higher contrast, and reduced motion. The main science workflow uses plain-language instructions, presets, validation messages, and progressive disclosure for methods.
- **Guide and alerts:** the Guide offers beginner/researcher wording, preset questions that need no typing, optional voice input/read-aloud, English/Urdu answers, and written output. Push alerts are always written, with vibration best-effort; sound is not required. Install and notification prompts happen only after user actions.
- **Regional comparison:** trend direction is named in words and reported numerically; color is supplementary. The results table is horizontally scrollable on small screens.

## Limits and follow-up review

- Voice recognition depends on browser support, device permissions, language availability, and a secure context. It is optional; the main analysis does not require a question.
- The entire product has not yet been reviewed with screen readers, speech control, switch access, magnification at 200%, color-vision simulation, or automated WCAG tooling.
- Some third-party map controls are maintained by Cesium and may have different accessibility behavior by browser.
- Urdu is offered as an interface language and Guide answer language. Localized catalogs cover page controls and Learning Center articles, but some hard-coded text, provider-supplied content, scientific names, and source labels may remain English. Urdu still needs fluent editorial and full RTL/device review.

Report accessibility defects with the page, browser/assistive technology, and the keyboard or speech steps that reproduce the issue.
