import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, MapPin, ShieldAlert, Smartphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

const PLACES = [
  { name: 'Karachi, Pakistan', latitude: 24.86, longitude: 67.01 },
  { name: 'Lahore, Pakistan', latitude: 31.52, longitude: 74.36 },
  { name: 'Islamabad, Pakistan', latitude: 33.69, longitude: 73.06 },
  { name: 'London, United Kingdom', latitude: 51.51, longitude: -0.13 },
  { name: 'Nairobi, Kenya', latitude: -1.29, longitude: 36.82 },
  { name: 'Tokyo, Japan', latitude: 35.68, longitude: 139.69 },
];

const OWNER_TOKEN_KEY = 'terra-alert-owner-token';
const ACTIVE_KEY = 'terra-alerts-enabled';

function base64UrlToBytes(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function getOwnerToken() {
  let token = localStorage.getItem(OWNER_TOKEN_KEY);
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(OWNER_TOKEN_KEY, token);
  }
  return token;
}

export default function AlertsPage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const [place, setPlace] = useState(PLACES[0]);
  const [radiusKm, setRadiusKm] = useState(50);
  const [minimumMagnitude, setMinimumMagnitude] = useState(4);
  const [rainAmount, setRainAmount] = useState(20);
  const [rainProbability, setRainProbability] = useState(60);
  const [earthquakeEnabled, setEarthquakeEnabled] = useState(true);
  const [rainEnabled, setRainEnabled] = useState(true);
  const [active, setActive] = useState(() => localStorage.getItem(ACTIVE_KEY) === 'true');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const configuration = useQuery({ queryKey: ['alert-config'], queryFn: async () => { const response = await apiFetch('/api/alerts/config'); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Could not read alert service status.'); return data; }, retry: 1 });
  const config = configuration.data;
  const browserSupportsPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;

  useEffect(() => {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => {
      if (!subscription) { setActive(false); localStorage.removeItem(ACTIVE_KEY); }
    }).catch(() => {});
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) { setStatus(t('This browser does not offer location access. Choose a city or enter coordinates on the weather page.')); return; }
    setStatus(t('Waiting for location permission. Your location is not sent to TERRA until you turn alerts on.'));
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPlace({ name: 'Your selected location', latitude: Number(coords.latitude.toFixed(4)), longitude: Number(coords.longitude.toFixed(4)) });
      setStatus(t('Location selected for this alert setup. It is sent to TERRA only when you enable alerts.'));
    }, () => setStatus(t('Location was not shared. Choose a city instead.')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  async function enableAlerts(event) {
    event.preventDefault();
    if (!browserSupportsPush) { setStatus(t('This browser or connection does not support push alerts. Use HTTPS (or localhost), and try a supported browser.')); return; }
    if (!config?.canSubscribe) { setStatus(!config?.pushConfigured ? t('The server needs VAPID push keys.') : t('MongoDB is not connected, so alert settings cannot be saved yet.')); return; }
    if (!earthquakeEnabled && !rainEnabled) { setStatus(t('Choose earthquake reports, heavy-rain forecasts, or both.')); return; }
    setBusy(true); setStatus('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error(t('Allow notifications in your browser settings to receive alerts.'));
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.vapidPublicKey) });
      const ownerToken = getOwnerToken();
      const response = await apiFetch('/api/alerts/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(), ownerToken,
          location: { latitude: place.latitude, longitude: place.longitude },
          radiusKm: Number(radiusKm), minimumMagnitude: Number(minimumMagnitude),
          heavyRainMmPerHour: Number(rainAmount), minimumRainProbability: Number(rainProbability),
          hazards: { earthquake: earthquakeEnabled, heavyRain: rainEnabled },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save alert subscription.');
      setActive(true); localStorage.setItem(ACTIVE_KEY, 'true');
      setStatus(t('Alerts are enabled for this device. The server checks for matching data on its schedule.'));
    } catch (error) {
      setStatus(error.message ? t(error.message) : t('Could not enable alerts.'));
    } finally { setBusy(false); }
  }

  async function disableAlerts() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      let serverRemoved = true;
      if (subscription) {
        try {
          const response = await apiFetch('/api/alerts/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint, ownerToken: getOwnerToken() }) });
          serverRemoved = response.ok;
        } catch { serverRemoved = false; }
        await subscription.unsubscribe();
      }
      setActive(false); localStorage.removeItem(ACTIVE_KEY); setStatus(serverRemoved ? t('Alerts are turned off for this device.') : t('Alerts are off on this device. The server will remove the expired push registration when it next tries to deliver.'));
    } catch (error) { setStatus(error.message ? t(error.message) : t('Could not turn alerts off.')); }
    finally { setBusy(false); }
  }

  async function testDeviceNotification() {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(t('TERRA notification test'), { body: t('Written alerts are enabled on this device. System sound and vibration depend on device settings.'), icon: '/icon.svg', vibrate: [150, 100, 150], data: { url: '/alerts' } });
      setStatus(t('Test notification sent to this device. This tests display only, not the live server signal feed.'));
    } catch { setStatus(t('Could not show a test notification. Check browser notification permission.')); }
  }

  return <main className="page alerts-page">
    <header className="page-header"><p className="eyebrow">{t('Opt-in safety signals')}</p><h1>{t('Nearby hazard alerts')}</h1><p>{t('Receive a visible device notification for a nearby USGS earthquake report or a heavy-rain forecast. TERRA signals are not official warnings or earthquake predictions.')}</p></header>
    <section className="alert-boundary" aria-label={t('Important alert limitations')}><ShieldAlert size={20} aria-hidden="true" /><div><strong>{t('Use official local emergency alerts for safety decisions.')}</strong><p>{t('Earthquake reports arrive after the event is cataloged. Rain alerts are based on a weather model, not flood conditions. TERRA cannot guarantee delivery or timing. Keep your local emergency alert service enabled.')}</p></div></section>
    <section className="alert-status-card" aria-labelledby="alert-status-heading"><div className="alert-status-icon"><BellRing size={21} aria-hidden="true" /></div><div><h2 id="alert-status-heading">{active ? t('Alerts on for this device') : t('Set up this device')}</h2><p>{configuration.isLoading ? t('Checking server support…') : config?.canSubscribe ? t('Server checks about every {minutes} minutes.', { minutes: config.checkIntervalMinutes }) : !config?.pushConfigured ? t('The server has not configured push delivery yet.') : !config?.databaseConnected ? t('Alert settings cannot be stored until the server database connects.') : t('Check your browser support and try again.')}</p></div>{active && <CheckCircle2 size={20} className="alert-check" aria-label={t('Enabled')} />}</section>
    <form className="alert-settings" onSubmit={enableAlerts}>
      <fieldset><legend>{t('Where should TERRA check?')}</legend><div className="alert-place-row"><label htmlFor="alert-place">{t('Choose a location')}</label><select id="alert-place" value={PLACES.some((item) => item.name === place.name) ? place.name : 'custom'} onChange={(event) => { const selected = PLACES.find((item) => item.name === event.target.value); if (selected) setPlace(selected); }}><option value="custom">{t('Selected coordinates')}</option>{PLACES.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><button type="button" className="secondary" onClick={useMyLocation}><MapPin size={15} /> {t('Use my location')}</button></div><details className="alert-coordinate-entry"><summary>{t('Enter coordinates manually')}</summary><div><label>{t('Latitude')}<input type="number" min="-90" max="90" step="any" value={place.latitude} onChange={(event) => setPlace({ name: 'Custom coordinates', latitude: Number(event.target.value), longitude: place.longitude })} /></label><label>{t('Longitude')}<input type="number" min="-180" max="180" step="any" value={place.longitude} onChange={(event) => setPlace({ name: 'Custom coordinates', latitude: place.latitude, longitude: Number(event.target.value) })} /></label></div></details><label className="range-setting">{t('Alert radius:')} <strong>{radiusKm} {t('km')}</strong><input type="range" min="10" max="300" step="10" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)} /></label><p className="field-hint">{t('Your chosen coordinates are sent to the TERRA server only when you enable alerts. They are stored with this device’s push registration so the server can check while the website is closed.')}</p></fieldset>
      <fieldset><legend>{t('What should trigger a notification?')}</legend>
        <label className="alert-toggle"><input type="checkbox" checked={earthquakeEnabled} onChange={(event) => setEarthquakeEnabled(event.target.checked)} /><span><strong>{t('Earthquake catalog reports')}</strong><small>{t('USGS events inside the radius, at or above the selected magnitude.')}</small></span></label>
        {earthquakeEnabled && <label className="range-setting">{t('Minimum magnitude:')} <strong>{minimumMagnitude}</strong><input type="range" min="2.5" max="6" step="0.5" value={minimumMagnitude} onChange={(event) => setMinimumMagnitude(event.target.value)} /></label>}
        <label className="alert-toggle"><input type="checkbox" checked={rainEnabled} onChange={(event) => setRainEnabled(event.target.checked)} /><span><strong>{t('Heavy-rain forecast')}</strong><small>{t('Modelled hourly rainfall and precipitation probability meet your thresholds.')}</small></span></label>
        {rainEnabled && <><label className="range-setting">{t('Rain amount:')} <strong>{rainAmount} {t('mm/hour')}</strong><input type="range" min="5" max="50" step="5" value={rainAmount} onChange={(event) => setRainAmount(event.target.value)} /></label><label className="range-setting">{t('Minimum rain probability:')} <strong>{rainProbability}%</strong><input type="range" min="30" max="100" step="10" value={rainProbability} onChange={(event) => setRainProbability(event.target.value)} /></label></>}
      </fieldset>
      <div className="alert-action-row"><button type="submit" className="primary" disabled={busy || configuration.isLoading}>{busy ? t('Saving…') : active ? t('Update alert settings') : t('Enable device alerts')} <BellRing size={16} /></button>{active && <><button type="button" className="secondary" disabled={busy} onClick={testDeviceNotification}>{t('Test device notification')}</button><button type="button" className="secondary" disabled={busy} onClick={disableAlerts}>{t('Turn alerts off')}</button></>}</div>
      {status && <p role="status" aria-live="polite" className="alert-live-status">{status}</p>}
    </form>
    <section className="alert-how-it-works"><h2><Smartphone size={19} aria-hidden="true" /> {t('When the website is closed')}</h2><ol><li>{t('You allow notifications and choose a location and thresholds.')}</li><li>{t('TERRA’s running server checks USGS and forecast feeds on schedule.')}</li><li>{t('If a rule matches, it sends a push message to this device’s service worker.')}</li></ol><p>{t('Background delivery requires a live, internet-accessible server, working database, VAPID configuration, browser permission, and a device/browser that supports Web Push. Device notification sound is controlled by your operating system; the message is always written and vibration is best-effort.')}</p></section>
  </main>;
}
