import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CloudSun, Compass, ExternalLink, Globe2, MapPin, Radio, RefreshCw, Satellite, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

const getJson = async (url) => { const response = await apiFetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Live data is temporarily unavailable.'); return data; };
export default function HomePage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const formatRelative = (time) => { const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000)); return minutes < 1 ? t('just now') : t('{minutes} min ago', { minutes }); };
  const events = useQuery({ queryKey: ['events'], queryFn: () => getJson('/api/events'), refetchInterval: 300000, retry: 1 });
  const weather = useQuery({ queryKey: ['weather', 'home'], queryFn: () => getJson('/api/weather?latitude=20&longitude=0'), refetchInterval: 600000, retry: 1 });
  const health = useQuery({ queryKey: ['health'], queryFn: () => getJson('/api/health'), retry: 1 });
  const freshest = events.data?.retrievalTime || weather.data?.retrievalTime;
  const topEvents = events.data?.events?.slice(0, 4) || [];

  return <main className="page home-page">
    <section className="welcome-row">
      <div><p className="eyebrow"><span className="eyebrow-line" /> {t('THE LIVING INTELLIGENCE OF EARTH & SPACE')}</p><h1>{t('See how Earth')} <em>{t('is changing.')}</em></h1><p className="welcome-copy">{t('Compare real measurements across places and years. Find what is rising, falling, or moving in opposite directions—and see how strong the evidence is.')}</p>
        <div className="hero-actions"><Link to="/trend" className="primary"><Activity size={16} /> {t('Start a change analysis')} <ArrowRight size={16} /></Link><Link to="/explorer" className="text-link"><Globe2 size={16} /> {t('Explore the Earth')} <ArrowUpRight size={15} /></Link></div>
      </div>
      <div className="freshness"><span className="freshness-icon"><Radio size={15} /></span><div><strong>{t('Live observatory')}</strong><small>{freshest ? t('Updated {time}', { time: formatRelative(new Date(freshest).getTime()) }) : t('Connecting to public data')}</small></div><span className="freshness-dot" /></div>
    </section>

    <section className="getting-started" aria-labelledby="getting-started-title"><div className="getting-started-heading"><p className="eyebrow small-eyebrow">{t('A SIMPLE WAY TO BEGIN')}</p><h2 id="getting-started-title">{t('Ask a question. Follow the data.')}</h2></div><ol><li><span>1</span><div><strong>{t('Choose a measurement')}</strong><small>{t('Temperature, rainfall, humidity or wind.')}</small></div></li><li><span>2</span><div><strong>{t('Pick places and years')}</strong><small>{t('Compare real NASA data points.')}</small></div></li><li><span>3</span><div><strong>{t('Read the evidence')}</strong><small>{t('See the trend, uncertainty and source.')}</small></div></li></ol><Link to="/trend" className="getting-started-link">{t('Try a guided comparison')} <ArrowRight size={15} /></Link></section>

    <section className="signal-grid" aria-label={t('Live observations')}>
      <article className="signal-card signal-feature">
        <div className="signal-top"><div className="signal-icon"><Activity size={18} /></div><span className="source-tag"><span className="live-dot" /> USGS · {t('PAST 24 HOURS')}</span></div>
        <div className="signal-value">{events.data ? events.data.count : events.isLoading ? '—' : t('Unavailable')}</div>
        <div className="signal-label">{t('earthquakes in the feed')}</div>
        <p className="signal-note">{t('Reported worldwide by the U.S. Geological Survey. Event counts reflect the current feed.')}</p>
        <Link className="card-link" to="/events">{t('Explore seismic activity')} <ArrowRight size={15} /></Link>
      </article>
      <article className="signal-card weather-signal">
        <div className="signal-top"><div className="signal-icon soft"><CloudSun size={18} /></div><span className="source-tag">OPEN-METEO · 20°N, 0°E</span></div>
        <div className="weather-reading">{weather.data ? <>{Math.round(weather.data.current?.temperature_2m)}<span>°C</span></> : weather.isLoading ? '—' : '—'}</div>
        <div className="signal-label">{t('air temperature · tropical Atlantic')}</div>
        <div className="weather-meta"><span><Wind size={14} /> {weather.data?.current?.wind_speed_10m ?? '—'} km/h {t('wind')}</span><span>{weather.data?.current?.relative_humidity_2m ?? '—'}% {t('humidity')}</span></div>
        {weather.error && <p className="inline-error">{t('Weather observation unavailable.')} <button onClick={() => weather.refetch()}>{t('Retry')}</button></p>}
        <Link className="card-link" to="/weather">{t('Open weather explorer')} <ArrowRight size={15} /></Link>
      </article>
      <article className="signal-card systems-signal">
        <div className="signal-top"><div className="signal-icon warm"><Compass size={18} /></div><span className="source-tag">{t('DATA SYSTEMS')}</span></div>
        <div className="system-status"><span className={`status-indicator ${health.data?.readiness === 'ready' ? 'good' : ''}`} />{health.data?.readiness === 'ready' ? t('Ready') : health.data?.readiness === 'degraded' ? t('Degraded') : health.isLoading ? t('Checking') : t('Status unknown')}</div>
        <div className="signal-label">{t('TERRA data gateway')}</div>
        <p className="signal-note">{t('Public observations are fetched from providers when requested. A failed source never becomes a zero.')}</p>
        <Link className="card-link" to="/sources">{t('Review data sources')} <ArrowRight size={15} /></Link>
      </article>
    </section>

    <section className="dashboard-lower">
      <div className="activity-panel">
        <div className="section-heading"><div><p className="eyebrow small-eyebrow">{t('OBSERVATIONS · GLOBAL')}</p><h2>{t('Seismic activity')}</h2></div><Link to="/events" className="subtle-link">{t('Full event feed')} <ArrowUpRight size={14} /></Link></div>
        <div className="feed-meta"><span><span className="live-dot" /> {t('USGS earthquake feed')}</span><span>{events.data?.retrievalTime ? t('Retrieved {time}', { time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(events.data.retrievalTime)) }) : t('Awaiting source')}</span></div>
        {events.isLoading && <div className="feed-state"><RefreshCw size={16} className="spin" /> {t('Loading latest observations…')}</div>}
        {events.error && <div className="feed-state error-state">{t('Live data is temporarily unavailable.')} <button onClick={() => events.refetch()}>{t('Retry')}</button></div>}
        {events.data && topEvents.length === 0 && <div className="feed-state">{t('No events were returned by the source for this period.')}</div>}
        {topEvents.length > 0 && <div className="event-rows">{topEvents.map((event) => <article key={event.id} className="event-row"><div className="magnitude">{event.magnitude == null ? '—' : event.magnitude.toFixed(1)}</div><div className="event-place"><strong>{event.place}</strong><span><MapPin size={12} /> {event.coordinates[1].toFixed(2)}°, {event.coordinates[0].toFixed(2)}°</span></div><div className="event-time">{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(event.time))}<small>{new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(event.time))}</small></div><ArrowUpRight className="event-open" size={15} /></article>)}</div>}
      </div>
      <aside className="explore-panel"><div className="explore-illustration" aria-hidden="true"><div className="globe-glow" /><div className="globe-grid" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="globe-coordinate">34.05° N<br />118.24° W</span><span className="globe-caption">{t('EARTH · SYSTEM VIEW')}</span></div><p className="eyebrow small-eyebrow">{t('SEE THE WHOLE SYSTEM')}</p><h2>{t('Signals connect.')}</h2><p className="explore-copy">{t('A storm, a shifting plate, a warming ocean. Zoom out and follow the relationships.')}</p><Link to="/explorer" className="explore-link">{t('Enter the planetary explorer')} <ArrowRight size={15} /></Link></aside>
    </section>
    <section className="trust-strip"><span><Satellite size={16} /> {t('Real public datasets')}</span><span><ExternalLink size={15} /> {t('Source attribution')}</span><span><ArrowDownRight size={15} /> {t('Observation is not prediction')}</span></section>
  </main>;
}
