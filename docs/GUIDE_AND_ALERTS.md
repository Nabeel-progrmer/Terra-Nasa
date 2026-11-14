# TERRA Guide, installation, and hazard alerts

## TERRA Guide

The Guide has beginner and researcher explanation styles, English and Urdu replies, suggested questions, optional speech input, and optional read-aloud. Its reviewed answers are available without an AI key. The optional generated-answer path uses Groq's OpenAI-compatible chat-completions API; it is not a separately trained Earth-science model and generated text is not peer reviewed. Set `GROQ_API_KEY` in the server `.env`, optionally choose an active account-enabled `GROQ_MODEL`, and restart the API. Never put the key in client code or commit `.env`. By default, no user-specific live data is attached. Before submitting, the user may explicitly choose Open-Meteo weather at entered coordinates or NOAA SWPC space-weather context. TERRA fetches the selected source on the server and includes its source URLs and valid times in the answer; if retrieval fails, no AI explanation is generated. The guide distinguishes model output and propagated estimates from direct observations and official warnings. See [Groq API docs](https://console.groq.com/docs/openai) and [available models](https://console.groq.com/docs/models).

## Current location and privacy

The Explore Earth, Weather, and Space Explorer pages request device location only after the user selects **Use my location** and approves the browser prompt. This requires HTTPS in production; localhost is allowed for development. Coordinates are used in memory to center the map or request Open-Meteo weather and are not written to browser storage. Sky calculations run locally in the TERRA server and do not call an astronomy provider. Users can deny permission and continue with city presets or manual coordinates. Location weather is forecast-model output, not a direct observation. The Guide does not attach a location unless the user selects weather context and submits a question.

## Browser installation

TERRA includes a web-app manifest, SVG and PNG app icons, install action, Apple web-app metadata, and a service worker. Production deployments must use HTTPS; `localhost` is supported for development. The **Install app** action opens the browser's install prompt when supported, otherwise it gives device-specific instructions:

- **Windows:** Chrome's address-bar install icon or menu; Edge: **Settings and more → Apps → Install this site as an app**.
- **Android:** Chrome menu → **Install app** or **Add to Home screen**.
- **iPhone/iPad:** Open in Safari → **Share → Add to Home Screen**. iOS does not provide a website-triggered install prompt.
- **macOS:** Safari on macOS Sonoma or newer: **File → Add to Dock**; Chrome/Edge: use the browser's install option.

Other browsers may only offer a shortcut or may not support installation. A PWA is not a native app-store package and cannot be installed by a website on every browser/device combination. The service worker caches the app shell; live science data still requires an internet connection.

## Background push alerts

Push is opt-in per device. A user chooses a location, alert radius, earthquake magnitude, and rain/probability thresholds, then grants notification permission. TERRA stores the location and push subscription in MongoDB. The server scheduler checks the USGS ComCat catalog and Open-Meteo forecast approximately every five minutes by default, then sends Web Push using VAPID. A live reachable Node server, connected MongoDB, working VAPID keys, outbound access to providers and browser push services, HTTPS in production, and browser/device notification support are all required. Push timing/delivery, vibration, and system sound are best effort and controlled partly by the device.

Generate a VAPID pair with `node -e "console.log(require('web-push').generateVAPIDKeys())"`. Put the public and private values in the server’s `.env` as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to a real support email or HTTPS contact before production. Do not commit the private key. After changing `.env`, restart the API.

### Signal limits and safety

- Earthquake messages are after-event reports from USGS ComCat. They do not predict earthquakes or provide earthquake early warning.
- Rain messages are threshold matches on Open-Meteo hourly model output. User-selected thresholds are not government warning criteria and do not determine flood risk.
- TERRA does not currently integrate an authoritative, jurisdiction-specific civil warning/evacuation feed. Keep official local warning services enabled and follow emergency authorities. TERRA is not an emergency service.
- USGS custom radius queries are documented at [FDSN Event Web Service](https://earthquake.usgs.gov/fdsnws/event/1/wsdl); forecast fields come from [Open-Meteo](https://open-meteo.com/en/docs). For flooding, NWS safety guidance says to move to higher ground and avoid walking or driving through floodwater ([NWS flood safety](https://www.weather.gov/safety/flood)).
