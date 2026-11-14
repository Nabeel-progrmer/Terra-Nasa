import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Accessibility, Activity, ArrowUpRight, BellRing, BookOpen, Bot, Check, Globe2, LayoutDashboard, Menu, Orbit, Radio, Search, UserRound, Waves, Wind, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { getLocale, readSavedLocale, selectableLocales, translate } from './i18n.js';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const WeatherPage = lazy(() => import('./pages/WeatherPage.jsx'));
const EventsPage = lazy(() => import('./pages/EventsPage.jsx'));
const ExplorerPage = lazy(() => import('./pages/ExplorerPage.jsx'));
const TrendPage = lazy(() => import('./pages/TrendPage.jsx'));
const SourcesPage = lazy(() => import('./pages/SourcesPage.jsx'));
const InvestigationsPage = lazy(() => import('./pages/InvestigationsPage.jsx'));
const GuidePage = lazy(() => import('./pages/GuidePage.jsx'));
const LearningCenterPage = lazy(() => import('./pages/LearningCenterPage.jsx'));
const AlertsPage = lazy(() => import('./pages/AlertsPage.jsx'));
const SpaceExplorerPage = lazy(() => import('./pages/SpaceExplorerPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));

const navigation = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Earth explorer', to: '/explorer', icon: Globe2 },
  { label: 'Weather', to: '/weather', icon: Wind },
  { label: 'Live events', to: '/events', icon: Activity },
  { label: 'Climate trends', to: '/trend', icon: Waves },
  { label: 'Space explorer', to: '/space', icon: Orbit },
  { label: 'TERRA Guide', to: '/guide', icon: Bot },
  { label: 'Learning center', to: '/learn', icon: BookOpen },
  { label: 'Hazard alerts', to: '/alerts', icon: BellRing },
  { label: 'Account', to: '/account', icon: UserRound },
];
const defaults = { largeText: false, highContrast: false, reduceMotion: false };

function getInstallGuidance() {
  const userAgent = navigator.userAgent || '';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isAppleMobile) {
    return {
      title: 'Install on iPhone or iPad',
      steps: ['Open this site in Safari.', 'Tap Share, then choose Add to Home Screen.', 'Tap Add. Open TERRA from the new Home Screen icon.'],
      note: 'iOS does not allow websites to show an automatic install prompt. Use Safari for this manual install.',
    };
  }
  if (/Android/i.test(userAgent)) {
    return {
      title: 'Install on Android',
      steps: ['Open this site in Chrome.', 'Tap the browser menu, then Install app or Add to Home screen.', 'Confirm the prompt and open TERRA from your apps.'],
      note: 'If Install app is not shown, update the page in Chrome and check the browser menu.',
    };
  }
  if (/Windows/i.test(platform) || /Windows/i.test(userAgent)) {
    return {
      title: 'Install on Windows',
      steps: ['In Chrome, use the install icon in the address bar or the menu’s Install TERRA option.', 'In Microsoft Edge, open Settings and more → Apps → Install this site as an app.', 'Confirm the prompt. TERRA will open in its own app window.'],
      note: 'The exact menu name depends on your browser version.',
    };
  }
  if (/Mac/i.test(platform) || /Macintosh|Mac OS/i.test(userAgent)) {
    return {
      title: 'Install on Mac',
      steps: ['In Safari on macOS Sonoma or newer, choose File → Add to Dock.', 'In Chrome or Edge, open the browser menu and choose Install TERRA.', 'Confirm the prompt and launch TERRA from the Dock or Applications.'],
      note: 'Safari’s Add to Dock option is available on macOS Sonoma and newer.',
    };
  }
  return {
    title: 'Install from your browser',
    steps: ['Open this site in a browser that supports web apps, such as Chrome, Edge, or Safari.', 'Open the browser menu and choose Install app, Add to Home Screen, or Add to Dock.', 'Confirm the prompt and launch TERRA from your device.'],
    note: 'Firefox and some embedded browsers may not offer app installation. Try your device’s current Safari, Chrome, or Edge browser.',
  };
}

function readPreferences() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('terra-accessibility') || '{}') }; }
  catch { return defaults; }
}

function FocusedPage({ children }) {
  useEffect(() => {
    requestAnimationFrame(() => {
      const heading = document.querySelector('.route-content h1');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }, []);
  return children;
}

function Sidebar({ onNavigate, locale }) {
  const t = (source) => translate(locale, source);
  return <aside className="sidebar" id="primary-navigation" aria-label={t('Primary navigation')}>
    <NavLink to="/" className="brand-lockup" onClick={onNavigate} aria-label="TERRA home">
      <span className="brand-mark" aria-hidden="true"><Orbit size={21} strokeWidth={1.7} /></span>
      <span className="brand-name">terra<span>.</span><small>EARTH INTELLIGENCE</small></span>
    </NavLink>
    <p className="nav-caption">{t('OBSERVATORY')}</p>
    <nav className="side-nav" aria-label={t('Observatory pages')}>
      {navigation.map(({ label, to, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{t(label)}</span>{label === 'Live events' && <span className="nav-live-dot" aria-hidden="true" />}
      </NavLink>)}
    </nav>
    <p className="nav-caption nav-caption-lower">{t('YOUR RESEARCH')}</p>
    <nav className="side-nav" aria-label={t('Research pages')}>
      <NavLink to="/investigations" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onNavigate}><BookOpen size={17} aria-hidden="true" /><span>{t('Field notes')}</span></NavLink>
      <NavLink to="/sources" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onNavigate}><Radio size={17} aria-hidden="true" /><span>{t('Data sources')}</span></NavLink>
    </nav>
    <div className="sidebar-bottom"><div className="orbit-art" aria-hidden="true"><div className="orbit-earth" /></div><p>{t('One planet.')}<br /><strong>{t('Many connected systems.')}</strong></p><span>{t('Follow the evidence wherever it leads.')}</span></div>
    <div className="sidebar-foot">{t('A clearer view of our living planet')} <span>v1.0</span></div>
  </aside>;
}

function AccessibilityPanel({ preferences, onToggle, hidden, locale, onLocaleChange }) {
  const t = (source) => translate(locale, source);
  const options = [
    { key: 'largeText', label: 'Larger text', description: 'Enlarge the page while keeping content readable.' },
    { key: 'highContrast', label: 'High contrast', description: 'Strengthen text, controls, and boundary contrast.' },
    { key: 'reduceMotion', label: 'Reduce motion', description: 'Limit animation and non-essential transitions.' },
  ];
  return <section className="accessibility-panel" id="accessibility-panel" aria-label={t('Language and accessibility settings')} hidden={hidden}>
    <div className="accessibility-panel-heading"><div><strong>{t('Make TERRA easier to use')}</strong><span>{t('These display preferences are saved on this device.')}</span></div><Accessibility size={19} aria-hidden="true" /></div>
    <label className="accessibility-language" htmlFor="app-language">{t('Language')}</label>
    <select id="app-language" value={locale} onChange={(event) => onLocaleChange(event.target.value)}>
      {selectableLocales.map((item) => <option key={item.locale} value={item.locale}>{item.nativeName} · {item.locale} · {t(item.interface || 'Not yet translated')}</option>)}
    </select>
    {locale === 'ur-PK' && <p className="accessibility-note">اردو انٹرفیس فعال ہے۔ سائنسی نام، provider labels اور units اصل صورت میں رہ سکتے ہیں تاکہ ماخذ سے مطابقت برقرار رہے۔</p>}
    {locale !== 'ur-PK' && locale !== 'en-US' && <p className="accessibility-note">{t('The selected language is not fully translated yet. Untranslated pages remain in English.')}</p>}
    <div className="accessibility-options">{options.map(({ key, label, description }) => <button key={key} type="button" className={`accessibility-option${preferences[key] ? ' enabled' : ''}`} aria-pressed={preferences[key]} onClick={() => onToggle(key)}><span className="accessibility-checkbox" aria-hidden="true">{preferences[key] && <Check size={14} />}</span><span><strong>{t(label)}</strong><small>{t(description)}</small></span></button>)}</div>
    <p className="accessibility-note">{t('TERRA does not require hearing. Charts have written summaries and data tables, and all controls work with a keyboard.')}</p>
  </section>;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installMessage, setInstallMessage] = useState('');
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [locale, setLocale] = useState(readSavedLocale);
  const [preferences, setPreferences] = useState(readPreferences);
  const location = useLocation();
  const menuButtonRef = useRef(null);
  const accessibilityButtonRef = useRef(null);
  const installButtonRef = useRef(null);
  const installGuideRef = useRef(null);
  const t = (source) => translate(locale, source);
  const pageName = location.pathname.startsWith('/learn') ? t('Learning center') : t(navigation.find((item) => item.to === location.pathname)?.label || (location.pathname === '/sources' ? 'Data sources' : location.pathname === '/investigations' ? 'Field notes' : 'TERRA'));
  const installGuidance = getInstallGuidance();
  const localizedInstallGuidance = {
    title: t(installGuidance.title),
    steps: installGuidance.steps.map(t),
    note: t(installGuidance.note),
  };

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.largeText = String(preferences.largeText);
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.reduceMotion = String(preferences.reduceMotion);
    try { localStorage.setItem('terra-accessibility', JSON.stringify(preferences)); } catch { /* The settings stay active for this visit. */ }
  }, [preferences]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getLocale(locale).direction;
    try { localStorage.setItem('terra-learning-locale', locale); } catch { /* The selected locale remains active for this visit. */ }
  }, [locale]);
  useEffect(() => {
    const onNetworkChange = () => setIsOnline(window.navigator.onLine);
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);
    window.addEventListener('terra:sw-update-ready', onUpdateReady);
    return () => {
      window.removeEventListener('online', onNetworkChange);
      window.removeEventListener('offline', onNetworkChange);
      window.removeEventListener('terra:sw-update-ready', onUpdateReady);
    };
  }, []);
  useEffect(() => {
    const onInstallPrompt = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const onInstalled = () => { setInstallPrompt(null); setInstallMessage(t('TERRA is installed on this device.')); };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onInstallPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, [locale]);
  useEffect(() => {
    setAccessibilityOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (menuOpen) document.querySelector('#primary-navigation a')?.focus();
  }, [menuOpen]);
  useEffect(() => {
    if (installGuideOpen) installGuideRef.current?.focus();
  }, [installGuideOpen]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      } else if (event.key === 'Escape' && installGuideOpen) {
        setInstallGuideOpen(false);
        installButtonRef.current?.focus();
      } else if (event.key === 'Escape' && accessibilityOpen) {
        setAccessibilityOpen(false);
        accessibilityButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen, accessibilityOpen, installGuideOpen]);

  async function installApp() {
    if (!installPrompt) {
      setInstallGuideOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallMessage(choice.outcome === 'accepted' ? t('TERRA is being installed.') : t('Installation was cancelled. You can try again or follow the device-specific steps.'));
      if (choice.outcome !== 'accepted') setInstallGuideOpen(true);
      setInstallPrompt(null);
    } catch (error) {
      console.error('TERRA installation prompt failed:', error);
      setInstallMessage(t('The browser could not open its install prompt. Follow the device-specific steps below.'));
      setInstallGuideOpen(true);
    }
  }

  async function applyUpdate() {
    const registration = await navigator.serviceWorker?.getRegistration('/');
    if (registration?.waiting) registration.waiting.postMessage({ type: 'TERRA_SKIP_WAITING' });
    else setUpdateReady(false);
  }

  const isInstalled = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

  return <div className="app-shell" lang={locale}>
    <a className="skip-link" href="#main-content">{t('Skip to main content')}</a>
    <button type="button" className={`mobile-scrim${menuOpen ? ' visible' : ''}`} aria-label={t('Close navigation')} tabIndex={menuOpen ? 0 : -1} onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} />
    <div className={`sidebar-wrap${menuOpen ? ' open' : ''}`}><Sidebar locale={locale} onNavigate={() => setMenuOpen(false)} /></div>
    <div className="main-column">
      <header className="app-topbar">
        <button type="button" ref={menuButtonRef} className="mobile-menu" aria-label={t(menuOpen ? 'Close navigation' : 'Open navigation')} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <div className="breadcrumb" aria-label={`${t('Workspace')}: ${pageName}`}><span>{t('Workspace')}</span><span className="crumb-slash" aria-hidden="true">/</span><strong>{pageName}</strong></div>
        <div className="topbar-actions"><span className="utc-chip"><span className="live-dot" aria-hidden="true" /> {t('GLOBAL OBSERVATORY')}</span><NavLink to="/explorer" className="search-button" aria-label={t('Explore the planet')}><Search size={16} aria-hidden="true" /><span>{t('Explore the planet')}</span></NavLink>{!isInstalled && <button type="button" ref={installButtonRef} className="install-trigger" aria-label={t('Install TERRA on this device')} onClick={installApp}><span aria-hidden="true">↓</span> {t('Install app')}</button>}<button type="button" ref={accessibilityButtonRef} className="accessibility-trigger" aria-label={t('Language and accessibility settings')} aria-expanded={accessibilityOpen} aria-controls="accessibility-panel" onClick={() => setAccessibilityOpen((open) => !open)}><Accessibility size={17} aria-hidden="true" /><span>{t('Access')}</span></button></div>
      </header>
      {locale !== 'en-US' && <p className="locale-coverage-status" role="status">{t('The selected language is not fully translated yet. Untranslated pages remain in English.')}</p>}
      <p className={`pwa-network-status ${isOnline ? 'online' : 'offline'}`} role="status" aria-live="polite">{t(isOnline ? 'Online — reconnecting may refresh live observations.' : 'Offline — live Earth and space data cannot refresh. Measurements still visible were fetched earlier; check their source timestamps and treat them as stale.')}</p>
      {updateReady && <section className="pwa-update-notice" role="status"><span>{t('A TERRA update is ready.')}</span><button type="button" onClick={applyUpdate}>{t('Update now')}</button></section>}
      {installMessage && <p className="install-message" role="status" aria-live="polite">{installMessage}<button type="button" aria-label={t('Dismiss install message')} onClick={() => setInstallMessage('')}>×</button></p>}
      {installGuideOpen && <section className="install-guide" aria-labelledby="install-guide-title" aria-describedby="install-guide-note" ref={installGuideRef} tabIndex="-1">
        <div className="install-guide-header"><div><p className="eyebrow small-eyebrow">{t('DEVICE INSTALLATION')}</p><h2 id="install-guide-title">{localizedInstallGuidance.title}</h2></div><button type="button" className="install-guide-close" onClick={() => { setInstallGuideOpen(false); installButtonRef.current?.focus(); }}>{t('Close')}</button></div>
        <ol>{localizedInstallGuidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <p id="install-guide-note">{localizedInstallGuidance.note} {t('Installation requires a secure HTTPS connection (localhost is supported for development). Offline mode caches the app shell; live science data still needs internet access.')}</p>
      </section>}
      <AccessibilityPanel preferences={preferences} hidden={!accessibilityOpen} locale={locale} onLocaleChange={setLocale} onToggle={(key) => setPreferences((current) => ({ ...current, [key]: !current[key] }))} />
      <div className="route-content" id="main-content" tabIndex="-1"><Suspense fallback={<div className="page-loading" role="status">{t('Loading this TERRA page...')}</div>}><Routes>
        <Route path="/" element={<FocusedPage><HomePage locale={locale} /></FocusedPage>} /><Route path="/weather" element={<FocusedPage><WeatherPage locale={locale} /></FocusedPage>} /><Route path="/events" element={<FocusedPage><EventsPage locale={locale} /></FocusedPage>} /><Route path="/explorer" element={<FocusedPage><ExplorerPage locale={locale} /></FocusedPage>} /><Route path="/trend" element={<FocusedPage><TrendPage locale={locale} /></FocusedPage>} /><Route path="/sources" element={<FocusedPage><SourcesPage locale={locale} /></FocusedPage>} /><Route path="/investigations" element={<FocusedPage><InvestigationsPage locale={locale} /></FocusedPage>} />
        <Route path="/guide" element={<FocusedPage><GuidePage locale={locale} /></FocusedPage>} /><Route path="/learn" element={<Navigate to="/learn/getting-started" replace />} /><Route path="/learn/:articleId" element={<FocusedPage><LearningCenterPage locale={locale} onLocaleChange={setLocale} /></FocusedPage>} /><Route path="/alerts" element={<FocusedPage><AlertsPage locale={locale} /></FocusedPage>} /><Route path="/space" element={<FocusedPage><SpaceExplorerPage locale={locale} /></FocusedPage>} /><Route path="/account" element={<FocusedPage><AccountPage locale={locale} /></FocusedPage>} />
      </Routes></Suspense></div>
      <footer className="app-footer"><span>{t('Observations are evidence. Interpretations are scientific inquiry.')}</span><span>{t('Built for a living planet')} <ArrowUpRight size={13} aria-hidden="true" /></span></footer>
    </div>
  </div>;
}
