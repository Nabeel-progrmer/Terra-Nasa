import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CloudSun, MapPin, RefreshCw } from 'lucide-react';
import useCurrentLocation from '../hooks/useCurrentLocation.js';
import { fetchWeather } from '../api/weather.js';
import { buildWeatherExplanation, getNextForecastHours, getWeatherDescription } from '../utils/weatherExplanation.js';
import { translate } from '../i18n.js';

const LOCATIONS = [
  { name: 'Karachi, Pakistan', latitude: 24.86, longitude: 67.01 },
  { name: 'London, United Kingdom', latitude: 51.51, longitude: -0.13 },
  { name: 'New York, United States', latitude: 40.71, longitude: -74.01 },
  { name: 'Tokyo, Japan', latitude: 35.68, longitude: 139.69 },
  { name: 'Nairobi, Kenya', latitude: -1.29, longitude: 36.82 },
  { name: 'Sydney, Australia', latitude: -33.87, longitude: 151.21 },
];

function formatValue(value, unit, digits = 1, locale = 'en-US') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return translate(locale, 'Unavailable');
  return `${Number(value).toLocaleString(locale, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
}

function formatProviderDate(date, locale = 'en-US') {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getInitialLocation(locationState) {
  const selected = locationState?.weatherLocation;
  const latitude = Number(selected?.latitude);
  const longitude = Number(selected?.longitude);
  if (!selected || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ...LOCATIONS[0] };
  }
  return {
    name: typeof selected.name === 'string' ? selected.name : 'Selected location',
    latitude,
    longitude,
  };
}

function ForecastCharts({ weather, locationName, locale }) {
  const t = (source, values) => translate(locale, source, values);
  const rows = getNextForecastHours(weather);
  const hasTemperatureOrWind = rows.some((row) => row.temperature !== null || row.wind !== null);
  const hasPrecipitationProbability = rows.some((row) => row.precipitationProbability !== null);

  if (!rows.length) {
    return <p className="weather-chart-empty">{t('The provider did not return a usable hourly timeline for this location. No chart values were generated.')}</p>;
  }

  return <section className="weather-charts" aria-labelledby="hourly-weather-title">
    <div className="section-heading">
      <div><p className="eyebrow small-eyebrow">{t('HOURLY MODEL OUTPUT · LOCATION TIME')}</p><h2 id="hourly-weather-title">{t('How conditions may change')}</h2></div>
    </div>
    <p className="weather-chart-note">{t('The provider’s current hour and up to 23 following hourly forecast values are plotted directly from Open-Meteo. Forecasts are model estimates, not observations; missing provider values stay blank.')}</p>
    <div className="weather-chart-grid">
      <article className="weather-chart-card">
        <h3>{t('Air temperature and wind')}</h3>
        {hasTemperatureOrWind ? <div className="weather-chart-canvas" role="img" aria-label={t('24 provider hourly model values for temperature and wind at {locationName}', { locationName })}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart accessibilityLayer data={rows} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(190,216,224,.13)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9aadaf', fontSize: 10 }} minTickGap={28} tickLine={false} axisLine={{ stroke: 'rgba(190,216,224,.24)' }} />
              <YAxis yAxisId="temperature" tick={{ fill: '#9aadaf', fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
              <YAxis yAxisId="wind" orientation="right" tick={{ fill: '#9aadaf', fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
              <Tooltip contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.25)', borderRadius: 7, fontSize: 11 }} labelStyle={{ color: '#e9f0f4' }} formatter={(value, name) => [formatValue(value, name === 'Air temperature' ? weather.current_units?.temperature_2m : weather.current_units?.wind_speed_10m, 1, locale), t(name)]} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
              <Line yAxisId="temperature" type="monotone" dataKey="temperature" name={t('Air temperature')} stroke="#8bd6db" strokeWidth={2} dot={false} connectNulls={false} />
              <Line yAxisId="wind" type="monotone" dataKey="wind" name={t('Wind speed')} stroke="#c3e889" strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div> : <p className="weather-chart-empty">{t('No temperature or wind values are available in this provider response.')}</p>}
      </article>
      <article className="weather-chart-card">
        <h3>{t('Hourly precipitation probability')}</h3>
        {hasPrecipitationProbability ? <div className="weather-chart-canvas" role="img" aria-label={t('24 provider hourly precipitation-probability values at {locationName}', { locationName })}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart accessibilityLayer data={rows} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(190,216,224,.13)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9aadaf', fontSize: 10 }} minTickGap={28} tickLine={false} axisLine={{ stroke: 'rgba(190,216,224,.24)' }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#9aadaf', fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
              <Tooltip contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.25)', borderRadius: 7, fontSize: 11 }} labelStyle={{ color: '#e9f0f4' }} formatter={(value) => [formatValue(value, weather.hourly_units?.precipitation_probability, 1, locale), t('Probability')]} />
              <Line type="monotone" dataKey="precipitationProbability" name={t('Probability')} stroke="#e6b77e" strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div> : <p className="weather-chart-empty">{t('The provider returned no hourly precipitation-probability values for this timeline.')}</p>}
        <p className="weather-chart-note">{t('Open-Meteo defines hourly precipitation probability as the ensemble-model probability of more than 0.1 mm of precipitation for the corresponding hourly interval. It is not the percentage of the location that will get wet.')}</p>
      </article>
    </div>
    <details className="weather-hourly-data">
      <summary>{t('View the plotted hourly values')}</summary>
      <div className="result-table-wrap"><table className="result-table">
        <caption className="visually-hidden">{t('Hourly forecast values from Open-Meteo for {locationName}', { locationName })}</caption>
        <thead><tr><th scope="col">{t('Provider local time')}</th><th scope="col">{t('Temperature')}</th><th scope="col">{t('Wind')}</th><th scope="col">{t('Precipitation chance')}</th><th scope="col">{t('Precipitation')}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.time}><th scope="row">{row.label}</th><td>{formatValue(row.temperature, weather.hourly_units?.temperature_2m, 1, locale)}</td><td>{formatValue(row.wind, weather.hourly_units?.wind_speed_10m, 1, locale)}</td><td>{formatValue(row.precipitationProbability, weather.hourly_units?.precipitation_probability, 1, locale)}</td><td>{formatValue(row.precipitation, weather.hourly_units?.precipitation, 1, locale)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </section>;
}

export default function WeatherPage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const routeLocation = useLocation();
  const [location, setLocation] = useState(() => getInitialLocation(routeLocation.state));
  const [coordinateDraft, setCoordinateDraft] = useState({ latitude: location.latitude, longitude: location.longitude });
  const currentLocation = useCurrentLocation();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['weather', location],
    queryFn: () => fetchWeather(location),
    retry: 1,
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
  });
  const requestCurrentLocation = async () => {
    const coordinates = await currentLocation.requestLocation();
    if (!coordinates) return;
    setLocation({ ...coordinates, name: 'Your current location' });
    setCoordinateDraft(coordinates);
  };

  return <main className="page weather-page">
    <header className="page-header"><p className="eyebrow">{t('Atmosphere · weather')}</p><h1>{t('Weather around you')}</h1><p>{t('Choose a city, enter coordinates, or opt in to share your device location for provider-model conditions, hourly graphs, a seven-day forecast, and an explanation grounded in the returned atmospheric fields.')}</p></header>

    <div className="location-action-row">
      <button type="button" className="primary" onClick={requestCurrentLocation} disabled={currentLocation.status === 'loading'}>
        <MapPin size={16} aria-hidden="true" />{currentLocation.status === 'loading' ? t('Finding location…') : t('Use my location')}
      </button>
      <span>{t('Your location is used for this weather request only; TERRA does not save it.')}</span>
    </div>
    {currentLocation.error && <p className="location-error" role="alert">{t(currentLocation.error)}</p>}
    <fieldset className="weather-location-picker"><legend>{t('Choose a city')}</legend><div className="weather-city-options">{LOCATIONS.map((city) => <button type="button" key={city.name} className={location.name === city.name ? 'selected' : ''} aria-pressed={location.name === city.name} onClick={() => { setLocation({ ...city }); setCoordinateDraft({ latitude: city.latitude, longitude: city.longitude }); }}><MapPin size={14} aria-hidden="true" />{city.name}</button>)}</div></fieldset>
    <details className="custom-coordinates"><summary>{t('Enter a different location with coordinates')}</summary><form onSubmit={(event) => { event.preventDefault(); setLocation({ latitude: Number(coordinateDraft.latitude), longitude: Number(coordinateDraft.longitude), name: 'Custom location' }); }}><div className="controls"><label>{t('Latitude')}<input type="number" step="any" min="-90" max="90" required value={coordinateDraft.latitude} onChange={(event) => setCoordinateDraft((current) => ({ ...current, latitude: event.target.value === '' ? '' : Number(event.target.value) }))} /></label><label>{t('Longitude')}<input type="number" step="any" min="-180" max="180" required value={coordinateDraft.longitude} onChange={(event) => setCoordinateDraft((current) => ({ ...current, longitude: event.target.value === '' ? '' : Number(event.target.value) }))} /></label></div><p>{t('Latitude ranges from −90 to 90. Longitude ranges from −180 to 180.')}</p><button type="submit" className="primary custom-location-button">{t('Use these coordinates')}</button></form></details>

    {isLoading && <p className="feed-state" role="status" aria-live="polite"><RefreshCw size={16} className="spin" aria-hidden="true" /> {t('Loading current conditions for {locationName}…', { locationName: location.name })}</p>}
    {error && <section className="analysis-state analysis-error" role="alert"><CloudSun size={18} aria-hidden="true" /><div><strong>{t('Weather data is temporarily unavailable')}</strong><span>{t('Check your connection and try again.')}</span><button type="button" onClick={() => refetch()}>{t('Retry')}</button></div></section>}
    {data && <>
      <section className="weather-current" aria-labelledby="weather-current-title">
        <div className="weather-current-heading">
          <div><p className="eyebrow small-eyebrow">{t('MODEL CONDITIONS · {locationName}', { locationName: location.name })}</p><h2 id="weather-current-title">{t('Current weather estimate')}</h2></div>
          <button type="button" className="weather-refresh" onClick={() => refetch()} disabled={isFetching} aria-label={t('Refresh weather data')}><RefreshCw size={15} className={isFetching ? 'spin' : ''} aria-hidden="true" />{isFetching ? t('Updating…') : t('Refresh')}</button>
        </div>
        <div className="weather-current-grid">
          <div className="weather-temperature">
            <strong>{formatValue(data.current?.temperature_2m, data.current_units?.temperature_2m, 1, locale)}</strong>
            <span>{t('Air temperature')} · {getWeatherDescription(data.current?.weather_code, locale) || t('Condition description unavailable')}</span>
          </div>
          <dl>
            <div><dt>{t('Feels like')}</dt><dd>{formatValue(data.current?.apparent_temperature, data.current_units?.apparent_temperature, 1, locale)}</dd></div>
            <div><dt>{t('Relative humidity')}</dt><dd>{formatValue(data.current?.relative_humidity_2m, data.current_units?.relative_humidity_2m, 0, locale)}</dd></div>
            <div><dt>{t('Wind at 10 m')}</dt><dd>{formatValue(data.current?.wind_speed_10m, data.current_units?.wind_speed_10m, 1, locale)}</dd></div>
            <div><dt>{t('Precipitation, previous hour')}</dt><dd>{formatValue(data.current?.precipitation, data.current_units?.precipitation, 1, locale)}</dd></div>
          </dl>
        </div>
        <p className="weather-provenance">{t('Coordinates: {coordinates}. Provider time: {providerTime}. Retrieved: {retrieved}. Source: {source}.', { coordinates: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`, providerTime: data.current?.time || t('Unavailable'), retrieved: data.retrievalTime ? new Date(data.retrievalTime).toLocaleString(locale) : t('Unavailable'), source: data.source || t('Unavailable') })} (<a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">{t('provider documentation')}</a>). {data.dataType || t('Provider model output; not a direct local observation.')} {t('TERRA checks for provider updates every five minutes; the forecast source itself updates on its own schedule.')}</p>
      </section>

      <section className="weather-explanation" aria-labelledby="weather-explanation-title">
        <div className="section-heading"><div><p className="eyebrow small-eyebrow">{t('EVIDENCE-BASED INTERPRETATION')}</p><h2 id="weather-explanation-title">{t('Why might the weather feel this way?')}</h2></div></div>
        <p className="weather-explanation-intro">{t('These notes are derived only from fields returned by the weather provider. They describe physical relationships, not a proven cause for this specific weather event.')}</p>
        {buildWeatherExplanation(data.current, data.current_units, locale).length > 0
          ? <ul className="weather-explanation-list">{buildWeatherExplanation(data.current, data.current_units, locale).map((item) => <li key={item.label}><strong>{item.label}</strong><p>{item.text}</p></li>)}</ul>
          : <p className="weather-chart-empty">{t('The provider did not return enough current fields to produce an explanation.')}</p>}
      </section>

      <ForecastCharts weather={data} locationName={location.name} locale={locale} />

      <section className="forecast-panel" aria-labelledby="forecast-title">
        <div className="section-heading"><div><p className="eyebrow small-eyebrow">{t('NEXT SEVEN DAYS · PROVIDER FORECAST')}</p><h2 id="forecast-title">{t('Daily forecast values')}</h2></div></div>
        <p className="weather-chart-note">{t('Daily precipitation chance is the provider’s maximum hourly probability for that day, not the probability of any precipitation at least once during the full day.')}</p>
        <div className="result-table-wrap"><table className="result-table forecast-table">
          <caption className="visually-hidden">{t('Seven-day weather model forecast for {locationName}', { locationName: location.name })}</caption>
          <thead><tr><th scope="col">{t('Date')}</th><th scope="col">{t('Low')}</th><th scope="col">{t('High')}</th><th scope="col">{t('Max hourly precip. chance')}</th><th scope="col">{t('Sunrise · local')}</th><th scope="col">{t('Sunset · local')}</th></tr></thead>
          <tbody>{(data.daily?.time || []).map((date, index) => <tr key={date}>
            <th scope="row">{formatProviderDate(date, locale)}</th>
            <td>{formatValue(data.daily.temperature_2m_min?.[index], data.daily_units?.temperature_2m_min, 1, locale)}</td>
            <td>{formatValue(data.daily.temperature_2m_max?.[index], data.daily_units?.temperature_2m_max, 1, locale)}</td>
            <td>{formatValue(data.daily.precipitation_probability_max?.[index], data.daily_units?.precipitation_probability_max, 0, locale)}</td>
            <td>{data.daily.sunrise?.[index]?.slice(11, 16) || 'Unavailable'}</td>
            <td>{data.daily.sunset?.[index]?.slice(11, 16) || 'Unavailable'}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </>}
  </main>;
}
