import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, MapPin, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

async function fetchEvents({ feed, minMagnitude }) {
  const params = new URLSearchParams({ feed, limit: '50' });
  if (minMagnitude !== '') params.set('minMagnitude', minMagnitude);
  const response = await apiFetch(`/api/events?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Earthquake feed unavailable');
  return data;
}

export default function EventsPage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const [feed, setFeed] = useState('all_day');
  const [minMagnitude, setMinMagnitude] = useState('');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['events', feed, minMagnitude], queryFn: () => fetchEvents({ feed, minMagnitude }), retry: 1 });

  return <main className="page">
    <header className="page-header"><p className="eyebrow">{t('Solid Earth · USGS')}</p><h1>{t('Recent earthquakes')}</h1><p>{t('Reported earthquake events from the U.S. Geological Survey. The list gives the time, magnitude, depth, and coordinates for each returned event.')}</p></header>
    <section className="event-filters" aria-label={t('Filter earthquake feed')}><label>{t('Time range')}<select value={feed} onChange={(event) => setFeed(event.target.value)}><option value="all_hour">{t('Past hour')}</option><option value="all_day">{t('Past day')}</option><option value="all_week">{t('Past 7 days')}</option><option value="all_month">{t('Past 30 days')}</option></select></label><label>{t('Minimum magnitude')}<select value={minMagnitude} onChange={(event) => setMinMagnitude(event.target.value)}><option value="">{t('Any reported magnitude')}</option><option value="2.5">2.5 and above</option><option value="4.5">4.5 and above</option><option value="6">6.0 and above</option></select></label></section>
    {isLoading && <p className="feed-state" role="status" aria-live="polite"><RefreshCw size={16} className="spin" aria-hidden="true" /> {t('Loading USGS earthquake reports…')}</p>}
    {error && <section className="analysis-state analysis-error" role="alert"><div><strong>{t('Earthquake reports are unavailable')}</strong><span>{t('Check your connection and try again.')}</span><button type="button" onClick={() => refetch()}>{t('Retry')}</button></div></section>}
    {data && <section aria-labelledby="event-list-title"><div className="event-list-heading"><div><h2 id="event-list-title">{t('Reported events: {count}', { count: data.count })}</h2><p>{t('Showing {count} · Feed retrieved {time}', { count: data.returned, time: new Date(data.retrievalTime).toLocaleString(locale) })}</p></div><span className="status-pill active">{t('USGS feed')}</span></div>{data.events.length === 0 ? <div className="status-panel"><p>{t('No events met this filter in the selected time range.')}</p></div> : <ul className="event-list">{data.events.map((event) => <li key={event.id} className="event-item"><article><div className="event-card-heading"><h3>{event.place}</h3><span className="magnitude-label">{t('Magnitude {magnitude}', { magnitude: event.magnitude ?? t('not reported') })}</span></div><dl className="event-details"><div><dt>{t('Time')}</dt><dd>{new Date(event.time).toLocaleString(locale)}</dd></div><div><dt>{t('Depth')}</dt><dd>{event.depthKm} {t('km')}</dd></div><div><dt>{t('Coordinates')}</dt><dd><MapPin size={13} aria-hidden="true" /> {event.coordinates[1].toFixed(3)}° {t('latitude')}, {event.coordinates[0].toFixed(3)}° {t('longitude')}</dd></div></dl>{event.detailUrl && <a className="event-source-link" href={event.detailUrl} target="_blank" rel="noreferrer">{t('Open USGS event details')} <ArrowUpRight size={14} aria-hidden="true" /></a>}</article></li>)}</ul>}</section>}
  </main>;
}
