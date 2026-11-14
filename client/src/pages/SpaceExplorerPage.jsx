import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Database, LocateFixed, Orbit, RefreshCw, Satellite, Search, Sun } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

const SpaceLocaleContext = createContext('en-US');
const useSpaceText = () => {
  const locale = useContext(SpaceLocaleContext);
  return (source) => translate(locale, source);
};

async function fetchSpaceEndpoint(path) {
  const response = await apiFetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Space data is temporarily unavailable.');
  return data;
}

function useSpaceData(queryKey, path, options = {}) {
  return useQuery({
    queryKey,
    queryFn: () => fetchSpaceEndpoint(path),
    retry: 1,
    refetchOnWindowFocus: false,
    ...options,
  });
}

function DataState({ query, label }) {
  const t = useSpaceText();
  if (query.isLoading) return <p className="space-state" role="status"><RefreshCw size={15} className="spin" aria-hidden="true" />{t('Loading {label}…').replace('{label}', t(label))}</p>;
  if (!query.error) return null;
  return <div className="space-error" role="alert"><span>{query.error.message}</span><button type="button" className="secondary" onClick={() => query.refetch()}>Retry</button></div>;
}

function formatValue(value, digits = 2) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
    : 'Unavailable';
}

function formatUtcTime(value, options = {}) {
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { timeZone: 'UTC', ...options });
}

function StatCard({ label, value, units, context, icon: Icon }) {
  const t = useSpaceText();
  return <article className="space-stat-card">
    <span className="space-stat-icon" aria-hidden="true"><Icon size={18} /></span>
    <p>{t(label)}</p>
    <strong>{value}<small>{units}</small></strong>
    <span>{t(context)}</span>
  </article>;
}

function AtmospherePanel() {
  const t = useSpaceText();
  const [altitudeKm, setAltitudeKm] = useState(0);
  const atmosphere = useSpaceData(
    ['space-atmosphere', altitudeKm],
    `/api/space/atmosphere?altitudeKm=${altitudeKm}`,
    { staleTime: 24 * 60 * 60 * 1000 },
  );
  const selected = atmosphere.data?.selected;
  const profile = atmosphere.data?.profile || [];

  return <section className="space-panel" aria-labelledby="space-atmosphere-title">
    <div className="space-section-heading">
      <div><p className="eyebrow small-eyebrow">{t('REFERENCE MODEL · LOWER ATMOSPHERE')}</p><h2 id="space-atmosphere-title">{t('Atmospheric profile')}</h2></div>
      <a href="https://ntrs.nasa.gov/citations/19770009539" target="_blank" rel="noreferrer">{t('Model source')} <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
    <p className="space-panel-intro">{t('Explore temperature, pressure, and density from the surface to 84.852 km using the U.S. Standard Atmosphere, 1976. This is a reference model—not your local weather or a live measurement.')}</p>
    <label className="altitude-control" htmlFor="space-altitude">
      <span>{t('Geopotential altitude')}</span>
      <strong>{altitudeKm} km · {selected?.layer ? t(selected.layer) : t('Loading model')}</strong>
      <input id="space-altitude" type="range" min="0" max="84" step="1" value={altitudeKm} onChange={(event) => setAltitudeKm(Number(event.target.value))} aria-describedby="altitude-model-limit" />
      <span className="altitude-range-labels"><span>{t('0 km · sea level')}</span><span>{t('84 km · model limit')}</span></span>
    </label>
    <DataState query={atmosphere} label="the standard-atmosphere model" />
    {selected && <div className="space-stat-grid atmosphere-stats">
      <StatCard label="Temperature" value={formatValue(selected.temperatureC, 1)} units="°C" context={`${formatValue(selected.temperatureK, 1)} K`} icon={Sun} />
      <StatCard label="Pressure" value={formatValue(selected.pressureHpa, 4)} units="hPa" context={`${formatValue(selected.pressurePa, 2)} Pa`} icon={Activity} />
      <StatCard label="Density" value={formatValue(selected.densityKgPerM3, 6)} units="kg/m³" context="Dry-air reference model" icon={Satellite} />
    </div>}
    {profile.length > 0 && <div className="atmosphere-chart-grid">
      <ProfileChart title="Temperature" data={profile} dataKey="temperatureC" unit="°C" color="#c3e889" />
      <ProfileChart title="Pressure" data={profile} dataKey="pressureHpa" unit="hPa" color="#8bd6db" />
      <ProfileChart title="Density" data={profile} dataKey="densityKgPerM3" unit="kg/m³" color="#e6b77e" />
    </div>}
    <div className="thermal-layer-note" id="altitude-model-limit">
      <strong>{t('Model boundary')}</strong>
      <p>{t('The reference profile includes the troposphere, stratosphere, and mesosphere only through 84.852 km. The thermosphere and exosphere extend above this model’s range. The ionosphere overlaps thermal layers; the magnetosphere is a separate, variable space-plasma region. Neither is represented as another thermal layer or calculated here. Composition profiles are not calculated.')}</p>
    </div>
  </section>;
}

function ProfileChart({ title, data, dataKey, unit, color }) {
  const t = useSpaceText();
  return <figure className="atmosphere-chart">
    <figcaption>{t(title)} <span>({unit})</span></figcaption>
    <div className="atmosphere-chart-canvas">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="rgba(190,216,224,.11)" strokeDasharray="3 3" />
          <XAxis dataKey="altitudeKm" type="number" domain={[0, 85]} tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#405157' }} label={{ value: 'Altitude (km)', position: 'insideBottom', offset: -2, fill: '#9aabad', fontSize: 10 }} />
          <YAxis scale={dataKey === 'pressureHpa' || dataKey === 'densityKgPerM3' ? 'log' : 'auto'} domain={dataKey === 'pressureHpa' || dataKey === 'densityKgPerM3' ? ['auto', 'auto'] : ['auto', 'auto']} tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.2)', borderRadius: 6, color: '#e9f0f4' }}
            formatter={(value) => [`${formatValue(Number(value), 5)} ${unit}`, title]}
            labelFormatter={(value) => `${value} km`}
          />
          <Line type="monotone" dataKey={dataKey} name={title} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <p className="visually-hidden">{title} varies with altitude in the U.S. Standard Atmosphere 1976 model. Use the altitude selector for numeric values.</p>
  </figure>;
}

function localDateTimeValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function SpaceVisibilityPanel() {
  const t = useSpaceText();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [localTime, setLocalTime] = useState(() => localDateTimeValue());
  const [request, setRequest] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const query = useSpaceData(
    ['space-ephemeris', request],
    request
      ? `/api/space/ephemeris?latitude=${request.latitude}&longitude=${request.longitude}&time=${encodeURIComponent(request.time)}`
      : '/api/space/ephemeris',
    { enabled: Boolean(request), staleTime: 0 },
  );
  const data = query.data;
  const bodies = data?.bodies || [];

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Location access is not available in this browser. Enter coordinates manually.');
      return;
    }
    setLocationStatus('Requesting your location. Your browser will ask for permission.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(String(Number(coords.latitude.toFixed(5))));
        setLongitude(String(Number(coords.longitude.toFixed(5))));
        setLocationStatus('Coordinates filled from your device. Select Calculate to run the local sky model.');
      },
      (error) => {
        const message = error.code === 1
          ? 'Location permission was denied. Enter coordinates manually or enable location in your browser settings.'
          : error.code === 2
            ? 'Your device could not determine a location. Enter coordinates manually and try again.'
            : 'The location request timed out. Try again or enter coordinates manually.';
        setLocationStatus(message);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function calculate(event) {
    event.preventDefault();
    const time = new Date(localTime);
    if (!Number.isFinite(time.getTime())) {
      setLocationStatus(t('Choose a valid local date and time.'));
      return;
    }
    setRequest({ latitude: Number(latitude), longitude: Number(longitude), time: time.toISOString() });
    setLocationStatus('');
  }

  return <section className="space-panel" aria-labelledby="space-sky-title">
    <div className="space-section-heading">
      <div><p className="eyebrow small-eyebrow">{t('LOCAL CALCULATION · SOLAR SYSTEM')}</p><h2 id="space-sky-title">{t('Ephemerides & sky geometry')}</h2></div>
      <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">{t('Model documentation')} <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
    <p className="space-panel-intro">{t('Calculate apparent positions for the Sun, Moon, and planets from a chosen location and time. Astronomy Engine performs these calculations locally; no location is sent to an astronomy provider.')}</p>
    <form className="sky-location-form" onSubmit={calculate}>
      <div className="sky-coordinate-grid">
        <label htmlFor="sky-latitude">{t('Latitude (°)')}<input id="sky-latitude" type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} required /></label>
        <label htmlFor="sky-longitude">{t('Longitude (°)')}<input id="sky-longitude" type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} required /></label>
        <button type="button" className="secondary" onClick={useCurrentLocation}><LocateFixed size={15} aria-hidden="true" />{t('Use my location')}</button>
      </div>
      <div className="sky-time-controls">
        <label htmlFor="sky-local-time">{t('Local date and time')}<input id="sky-local-time" type="datetime-local" value={localTime} onChange={(event) => setLocalTime(event.target.value)} required /></label>
        <button type="button" className="secondary" onClick={() => setLocalTime(localDateTimeValue())}>{t('Use current time')}</button>
        <button type="submit" className="primary"><Orbit size={15} aria-hidden="true" />{t('Calculate sky')}</button>
      </div>
      {locationStatus && <p className="space-inline-status" role="status">{locationStatus}</p>}
      <p className="space-form-help">{t('Coordinates are used only for the local calculation in this app. Elevation is assumed to be sea level (0 m).')}</p>
    </form>
    <DataState query={query} label="solar-system positions" />
    {data && <>
      <div className="space-provenance-box">
        <strong>{data.requestedTimeUtc} UTC</strong>
        <span>{t('Calculated at')} {formatUtcTime(data.computedAt)} UTC · {data.source}</span>
        <p>{data.limitations}</p>
      </div>
      <p className="space-panel-intro">{t('Geometric horizon:')} {formatValue(data.sky.geometricSunAltitudeDegrees, 1)}° {t('solar altitude. Astronomical night threshold: −18°. Rise and set search covers the next 24 hours; refraction is a standard estimate.')}</p>
      <figure className="ephemeris-chart">
        <figcaption>{t('Geometric altitude by solar-system body')} <span>· {t('0° is the horizon')}</span></figcaption>
        <div className="space-chart-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bodies} layout="vertical" margin={{ top: 8, right: 18, bottom: 4, left: 8 }}>
              <CartesianGrid stroke="rgba(190,216,224,.11)" strokeDasharray="3 3" />
              <XAxis type="number" domain={[-90, 90]} tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#405157' }} />
              <YAxis type="category" dataKey="name" width={68} tick={{ fill: '#b7c8c9', fontSize: 10 }} tickLine={false} axisLine={false} />
              <ReferenceLine x={0} stroke="#e6b77e" strokeDasharray="4 4" />
              <Tooltip contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.2)', borderRadius: 6, color: '#e9f0f4' }} formatter={(value) => [`${formatValue(Number(value), 2)}°`, 'Geometric altitude']} />
              <Bar dataKey="geometricAltitudeDegrees" name="Geometric altitude" isAnimationActive={false}>
                {bodies.map((body) => <Cell key={body.name} fill={body.aboveGeometricHorizon ? '#c3e889' : '#71858a'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="visually-hidden">{t('The chart shows calculated altitude relative to the geometric horizon for each body. A negative altitude is below the horizon.')}</p>
      </figure>
      <div className="space-table-scroll">
        <table className="space-data-table">
          <caption>{t('Calculated solar-system positions and next rise/set times in UTC')}</caption>
          <thead><tr><th scope="col">{t('Body')}</th><th scope="col">RA (hours)</th><th scope="col">Dec (°)</th><th scope="col">{t('Azimuth (°)')}</th><th scope="col">{t('Geometric altitude (°)')}</th><th scope="col">{t('Distance (AU)')}</th><th scope="col">{t('Phase')}</th><th scope="col">{t('Magnitude')}</th><th scope="col">{t('Rise next 24 h')}</th><th scope="col">{t('Set next 24 h')}</th></tr></thead>
          <tbody>{bodies.map((body) => <tr key={body.name}>
            <th scope="row">{body.name}</th>
            <td>{formatValue(body.rightAscensionHours, 3)}</td>
            <td>{formatValue(body.declinationDegrees, 3)}</td>
            <td>{formatValue(body.azimuthDegrees, 2)}</td>
            <td>{formatValue(body.geometricAltitudeDegrees, 2)}{body.aboveGeometricHorizon ? ` · ${t('above')}` : ` · ${t('below')}`}</td>
            <td>{formatValue(body.distanceAu, 6)}</td>
            <td>{formatValue(body.illuminatedFraction * 100, 1)}%</td>
            <td>{formatValue(body.visualMagnitude, 2)}</td>
            <td>{body.riseWithin24HoursUtc ? formatUtcTime(body.riseWithin24HoursUtc) : t('No rise in 24 h')}</td>
            <td>{body.setWithin24HoursUtc ? formatUtcTime(body.setWithin24HoursUtc) : t('No set in 24 h')}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-scope-note">
        <strong>{t('What “sky geometry” means')}</strong>
        <p>{t('Altitude and rise/set are calculated positions, not proof that an object can be seen. Clouds, haze, light pollution, terrain/buildings, moonlight, and weather-dependent refraction are not modeled. The library does not publish a numeric accuracy guarantee here; do not use these results for navigation or safety-critical timing.')}</p>
      </div>
    </>}
  </section>;
}

function SpaceWeatherPanel() {
  const locale = useContext(SpaceLocaleContext);
  const t = useSpaceText();
  const query = useSpaceData(['space-weather'], '/api/space/space-weather', {
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const data = query.data;
  const kp = data?.products?.planetaryKIndex || [];
  const dst = data?.products?.dstIndex || [];
  const xray = data?.products?.xrayFlux || [];
  const solarWind = data?.products?.propagatedSolarWind || [];
  const messages = data?.products?.recentMessages || [];
  const latestKp = kp.at(-1);
  const latestDst = dst.at(-1);
  const latestXray = xray.at(-1);
  const latestSolarWind = solarWind.at(-1);
  const chartData = kp.map((point) => ({
    ...point,
    label: formatUtcTime(point.time, { month: 'short', day: 'numeric', hour: 'numeric' }),
  }));
  const solarWindChartData = solarWind.map((point) => ({
    ...point,
    label: formatUtcTime(point.time, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  }));

  return <section className="space-panel" aria-labelledby="space-weather-title">
    <div className="space-section-heading">
      <div><p className="eyebrow small-eyebrow">{t('OBSERVED SPACE WEATHER')}</p><h2 id="space-weather-title">{t('Solar and geomagnetic activity')}</h2></div>
      <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noreferrer">NOAA SWPC <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
    <p className="space-panel-intro">{t('Satellite measurements and geomagnetic indices published by NOAA. Products can have different update times; each value retains its source timestamp.')}</p>
    <DataState query={query} label="NOAA space-weather products" />
    {data && <>
      {data.unavailableProducts.length > 0 && <p className="space-partial-note" role="status">{t('Some NOAA products did not respond: {products}. Available data is shown below.').replace('{products}', data.unavailableProducts.join(', '))}</p>}
      <div className="space-stat-grid">
        <StatCard label="Planetary Kp" value={formatValue(latestKp?.value, 2)} units="" context={latestKp ? `3-hour index · ${formatUtcTime(latestKp.time)} UTC` : 'No observation available'} icon={Activity} />
        <StatCard label="Dst index" value={formatValue(latestDst?.value, 0)} units="nT" context={latestDst ? `Hourly · ${formatUtcTime(latestDst.time)} UTC` : 'No observation available'} icon={Orbit} />
        <StatCard label="GOES soft X-ray" value={latestXray ? Number(latestXray.fluxWm2).toExponential(2) : 'Unavailable'} units="W/m²" context={latestXray ? `0.1–0.8 nm · ${formatUtcTime(latestXray.time)} UTC · GOES-${latestXray.satellite}` : 'No observation available'} icon={Sun} />
      </div>
      <div className="space-chart-wrap">
        <div className="space-chart-heading"><h3>{t('Planetary Kp history')}</h3><span>{t('Observed · NOAA SWPC · 3-hour intervals')}</span></div>
        {chartData.length > 0
          ? <div className="space-chart-canvas"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 15, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="rgba(190,216,224,.11)" strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={45} tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#405157' }} />
              <YAxis domain={[0, 9]} ticks={[0, 3, 5, 7, 9]} tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.2)', borderRadius: 6, color: '#e9f0f4' }} formatter={(value) => [`Kp ${formatValue(Number(value), 2)}`, 'Observed index']} labelFormatter={(label) => `${label} UTC`} />
              <Line type="monotone" dataKey="value" name="Kp" stroke="#8bd6db" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer></div>
          : <p className="space-empty">{t('NOAA did not provide Kp history.')}</p>}
        <div className="visually-hidden" role="region" aria-label={t('Planetary Kp history data table')}>
          <table><caption>{t('Observed Kp history from NOAA SWPC')}</caption><thead><tr><th scope="col">{t('Time')}</th><th scope="col">Kp</th></tr></thead><tbody>{kp.map((point) => <tr key={point.time}><th scope="row">{point.time} UTC</th><td>{point.value}</td></tr>)}</tbody></table>
        </div>
      </div>
      <section className="space-chart-wrap" aria-labelledby="solar-wind-title">
        <div className="space-chart-heading"><h3 id="solar-wind-title">{t('Solar wind propagated toward Earth')}</h3><span>{t('NOAA SWPC geospace · 1-minute samples')}</span></div>
        <p className="space-panel-intro">{t("These are NOAA-propagated solar-wind estimates, not direct measurements at Earth. Time labels show upstream sample time; each row also includes NOAA's propagated time.")}</p>
        {latestSolarWind && <div className="solar-wind-latest" role="group" aria-label={t('Latest propagated solar-wind values')}>
          <span><strong>{formatValue(latestSolarWind.speedKmS, 1)}</strong> km/s {t('speed')}</span>
          <span><strong>{formatValue(latestSolarWind.densityParticlesCm3, 2)}</strong> particles/cm³ {t('density')}</span>
          <span><strong>{formatValue(latestSolarWind.temperatureK, 0)}</strong> K {t('temperature')}</span>
          <span><strong>{formatValue(latestSolarWind.bzNt, 2)}</strong> nT Bz</span>
          <small>Propagated time: {formatUtcTime(latestSolarWind.propagatedTime)} UTC</small>
        </div>}
        {solarWindChartData.length > 0
          ? <div className="space-chart-canvas"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={solarWindChartData} margin={{ top: 8, right: 15, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="rgba(190,216,224,.11)" strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={45} tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#405157' }} />
              <YAxis tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
              <Tooltip contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.2)', borderRadius: 6, color: '#e9f0f4' }} formatter={(value) => [`${formatValue(Number(value), 1)} km/s`, 'Propagated speed']} labelFormatter={(label) => `${label} UTC`} />
              <Line type="monotone" dataKey="speedKmS" name="Solar-wind speed" stroke="#e6b77e" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer></div>
          : <p className="space-empty">{t('NOAA did not provide propagated solar-wind data.')}</p>}
        <div className="visually-hidden" role="region" aria-label={t('Propagated solar-wind values table')}>
          <table><caption>{t('NOAA-propagated solar wind near Earth; not direct measurements at Earth')}</caption><thead><tr><th scope="col">{t('Sample time UTC')}</th><th scope="col">{t('Propagated time UTC')}</th><th scope="col">{t('Speed km/s')}</th><th scope="col">{t('Density particles/cm³')}</th><th scope="col">{t('Temperature K')}</th><th scope="col">Bz nT</th></tr></thead><tbody>{solarWind.map((point) => <tr key={point.time}><th scope="row">{point.time}</th><td>{point.propagatedTime}</td><td>{point.speedKmS}</td><td>{point.densityParticlesCm3}</td><td>{point.temperatureK}</td><td>{point.bzNt}</td></tr>)}</tbody></table>
        </div>
      </section>
      <p className="space-provenance">{t('Retrieved')} {new Date(data.retrievedAt).toLocaleString(locale)}. {data.coverage}</p>
      <section className="swpc-messages" aria-labelledby="swpc-messages-title">
        <h3 id="swpc-messages-title"><AlertTriangle size={17} aria-hidden="true" /> {t('Recent NOAA messages')}</h3>
        <p>{t('These are notices issued in the last seven days, not a determination that a warning is currently active.')}</p>
        {messages.length > 0 ? <ul>{messages.slice(0, 5).map((message) => <li key={`${message.productId}-${message.issuedAt}`}><strong>{message.productId}</strong><time dateTime={message.issuedAt}>{formatUtcTime(message.issuedAt)} UTC</time><pre>{message.message}</pre></li>)}</ul> : <p className="space-empty">{t('No recent messages were returned by NOAA.')}</p>}
      </section>
    </>}
  </section>;
}

function NearEarthObjectsPanel() {
  const locale = useContext(SpaceLocaleContext);
  const t = useSpaceText();
  const query = useSpaceData(['near-earth-objects'], '/api/space/near-earth-objects', {
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });
  const data = query.data;

  return <section className="space-panel" aria-labelledby="space-neo-title">
    <div className="space-section-heading">
      <div><p className="eyebrow small-eyebrow">{t('SEVEN-DAY PREDICTIONS · NASA/JPL')}</p><h2 id="space-neo-title">{t('Near-Earth object approaches')}</h2></div>
      <a href="https://cneos.jpl.nasa.gov/" target="_blank" rel="noreferrer">NASA CNEOS <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
    <p className="space-panel-intro">{t("Scheduled close approaches from NASA/JPL's public NeoWs feed. Times are UTC; distance and size are estimates from orbital and brightness data.")}</p>
    <DataState query={query} label="NASA/JPL close approaches" />
    {data && <>
      <p className="space-partial-note">{data.note}</p>
      <p className="space-provenance">{t('{count} objects in the {start} through {end} window. Retrieved {time}.').replace('{count}', String(data.count)).replace('{start}', data.window.startDate).replace('{end}', data.window.endDate).replace('{time}', new Date(data.retrievedAt).toLocaleString(locale))}</p>
      {data.objects.length > 0 ? <div className="neo-grid">
        {data.objects.map((object) => <article className="neo-card" key={`${object.id}-${object.approachDate}`}>
          <div className="neo-card-heading"><div><p className="eyebrow small-eyebrow">{t('CLOSE APPROACH')} · {object.id}</p><h3>{object.name}</h3></div><span className={`neo-classification${object.nasaPotentiallyHazardous ? ' caution' : ''}`}>{object.nasaPotentiallyHazardous ? t('NASA/JPL PHO class') : t('No PHO flag')}</span></div>
          <dl>
            <div><dt>{t('Approach')}</dt><dd><time>{object.approachDate} UTC</time></dd></div>
            <div><dt>{t('Miss distance')}</dt><dd>{formatValue(object.missDistanceKm, 0)} km · {formatValue(object.missDistanceLunar, 1)} {t('lunar distances')}</dd></div>
            <div><dt>{t('Relative speed')}</dt><dd>{formatValue(object.relativeVelocityKmS, 2)} km/s</dd></div>
            <div><dt>{t('Estimated diameter')}</dt><dd>{formatValue(object.estimatedDiameterMinM, 0)}–{formatValue(object.estimatedDiameterMaxM, 0)} m</dd></div>
          </dl>
          <a href={object.nasaJplUrl} target="_blank" rel="noreferrer">{t('NASA/JPL object record')} <ArrowUpRight size={13} aria-hidden="true" /></a>
        </article>)}
      </div> : <p className="space-empty">{t('No objects were returned for this date window.')}</p>}
    </>}
  </section>;
}

function ExoplanetCatalogPanel() {
  const locale = useContext(SpaceLocaleContext);
  const t = useSpaceText();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const queryString = new URLSearchParams({ limit: '20' });
  if (search) queryString.set('search', search);
  const query = useSpaceData(
    ['exoplanets', search],
    `/api/space/exoplanets?${queryString}`,
    { staleTime: 15 * 60_000 },
  );
  const data = query.data;

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchText.trim());
  }

  return <section className="space-panel" aria-labelledby="space-exoplanets-title">
    <div className="space-section-heading">
      <div><p className="eyebrow small-eyebrow">{t('NASA EXOPLANET ARCHIVE · CONFIRMED PLANETS')}</p><h2 id="space-exoplanets-title">{t('Explore worlds around other stars')}</h2></div>
      <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">{t('NASA catalog')} <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
    <p className="space-panel-intro">{t('Search the NASA Exoplanet Archive’s default Planetary Systems solutions by planet or host-star name. With an empty search, the latest discovery years in the archive are shown first. This is an exoplanet catalog—not a complete catalog of deep-space objects.')}</p>
    <form className="catalog-search-form" onSubmit={submitSearch}>
      <label htmlFor="exoplanet-search">{t('Planet or host-star name')}</label>
      <div className="catalog-search-controls">
        <input id="exoplanet-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={60} pattern="[A-Za-z0-9][A-Za-z0-9 -]*" placeholder={t('For example: TRAPPIST-1')} aria-describedby="exoplanet-search-help" />
        <button type="submit" className="primary"><Search size={15} aria-hidden="true" />{t('Search catalog')}</button>
      </div>
      <small id="exoplanet-search-help">{t('Use letters, numbers, spaces, and hyphens. Searches are bounded to 20 results.')}</small>
    </form>
    <DataState query={query} label="NASA Exoplanet Archive records" />
    {data && <>
      <p className="space-provenance">{t('{count} catalog records returned{search}. Retrieved {time}.').replace('{count}', String(data.count)).replace('{search}', data.search ? ` ${t('for')} “${data.search}”` : '').replace('{time}', new Date(data.retrievedAt).toLocaleString(locale))}</p>
      {data.items.length > 0 ? <div className="space-table-scroll">
        <table className="space-data-table">
          <caption>{t('NASA Exoplanet Archive default planet solutions; missing values are shown as unavailable')}</caption>
          <thead><tr><th scope="col">{t('Planet')}</th><th scope="col">{t('Host star')}</th><th scope="col">{t('Discovery method')}</th><th scope="col">{t('Year')}</th><th scope="col">{t('Distance (pc)')}</th><th scope="col">{t('Orbital period (days)')}</th><th scope="col">{t('Radius (Jupiter radii)')}</th><th scope="col">{t('Mass (Jupiter masses)')}</th><th scope="col">{t('Star type')}</th></tr></thead>
          <tbody>{data.items.map((planet) => <tr key={planet.name}>
            <th scope="row">{planet.name}</th>
            <td>{planet.host}</td>
            <td>{planet.discoveryMethod || t('Unavailable')}</td>
            <td>{planet.discoveryYear ?? t('Unavailable')}</td>
            <td>{planet.distanceParsecs === null ? t('Unavailable') : formatValue(planet.distanceParsecs, 2)}</td>
            <td>{planet.orbitalPeriodDays === null ? t('Unavailable') : formatValue(planet.orbitalPeriodDays, 4)}</td>
            <td>{planet.radiusJupiter === null ? t('Unavailable') : formatValue(planet.radiusJupiter, 4)}</td>
            <td>{planet.massJupiter === null ? t('Unavailable') : formatValue(planet.massJupiter, 4)}</td>
            <td>{planet.hostSpectralType || t('Unavailable')}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="space-empty">{t('NASA Exoplanet Archive returned no matching records.')}</p>}
      <p className="space-partial-note">{data.limitations} <a href={data.queryUrl} target="_blank" rel="noreferrer">{t('Open the exact archive query')} <ArrowUpRight size={12} aria-hidden="true" /></a></p>
    </>}
  </section>;
}

const DEFAULT_PDS_LID = 'urn:nasa:pds:mars2020_rimfax';
const RIMFAX_CALIBRATED_EXAMPLE = 'urn:nasa:pds:mars2020_rimfax:data_calibrated:rimfax_calibrated_00010';

function PlanetaryArchivePanel() {
  const locale = useContext(SpaceLocaleContext);
  const t = useSpaceText();
  const [lidInput, setLidInput] = useState(DEFAULT_PDS_LID);
  const [archiveLid, setArchiveLid] = useState(DEFAULT_PDS_LID);
  const [pageCursors, setPageCursors] = useState(['']);
  const [history, setHistory] = useState([]);
  const [decodeRequested, setDecodeRequested] = useState(false);
  const [decodeRecordType, setDecodeRecordType] = useState('');
  const cursor = pageCursors.at(-1);
  const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
  const query = useSpaceData(
    ['planetary-archive', archiveLid, cursor],
    `/api/space/planetary-archive?lid=${encodeURIComponent(archiveLid)}${cursorQuery}`,
    { staleTime: 10 * 60_000 },
  );
  const data = query.data;
  const product = data?.product;
  const members = data?.members;
  const canBrowseMembers = product?.productType === 'Product_Bundle' || product?.productType === 'Product_Collection';
  const decodeTypeQuery = decodeRecordType === '' ? '' : `&recordType=${encodeURIComponent(decodeRecordType)}`;
  const decoded = useSpaceData(
    ['pds-decode', archiveLid, decodeRecordType],
    `/api/space/planetary-archive/decode?lid=${encodeURIComponent(archiveLid)}&limit=3${decodeTypeQuery}`,
    { enabled: decodeRequested && product?.productType === 'Product_Observational', staleTime: 15 * 60_000 },
  );

  function submitSearch(event) {
    event.preventDefault();
    const nextLid = lidInput.trim();
    setHistory([]);
    setPageCursors(['']);
    setDecodeRequested(false);
    setDecodeRecordType('');
    setArchiveLid(nextLid);
  }

  function openProduct(item) {
    setHistory((previous) => [...previous, product.lid]);
    setLidInput(item.lid);
    setPageCursors(['']);
    setDecodeRequested(false);
    setDecodeRecordType('');
    setArchiveLid(item.lid);
  }

  function openParent() {
    const parent = history.at(-1);
    if (!parent) return;
    setHistory((previous) => previous.slice(0, -1));
    setLidInput(parent);
    setPageCursors(['']);
    setDecodeRequested(false);
    setDecodeRecordType('');
    setArchiveLid(parent);
  }

  function loadExample() {
    setHistory([]);
    setPageCursors(['']);
    setLidInput(DEFAULT_PDS_LID);
    setArchiveLid(DEFAULT_PDS_LID);
    setDecodeRequested(false);
    setDecodeRecordType('');
  }

  function loadCalibratedExample() {
    setHistory([]);
    setPageCursors(['']);
    setLidInput(RIMFAX_CALIBRATED_EXAMPLE);
    setArchiveLid(RIMFAX_CALIBRATED_EXAMPLE);
    setDecodeRequested(false);
    setDecodeRecordType('');
  }

  function openNextPage() {
    if (members?.nextCursor) setPageCursors((previous) => [...previous, members.nextCursor]);
  }

  function openPreviousPage() {
    if (pageCursors.length > 1) setPageCursors((previous) => previous.slice(0, -1));
  }

  return <section className="space-panel" aria-labelledby="space-pds-title">
    <div className="space-section-heading">
      <div><p className="eyebrow small-eyebrow">{t('PLANETARY MISSION ARCHIVES · NASA PDS')}</p><h2 id="space-pds-title">{t('Browse planetary science archives')}</h2></div>
      <a href="https://pds.mcp.nasa.gov/api/search/1/api-docs" target="_blank" rel="noreferrer">PDS Registry API <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
    <p className="space-panel-intro">{t('Browse NASA Planetary Data System bundles, collections, and products by LID. The verified Mars 2020 RIMFAX bundle is preloaded. For supported PDS4 delimited observations, TERRA can decode actual archived measurements; unsupported binary layouts are reported rather than guessed.')}</p>
    <form className="pds-search-form" onSubmit={submitSearch}>
      <label htmlFor="pds-product-lid">{t('NASA PDS product LID')}</label>
      <div className="pds-search-controls">
        <input
          id="pds-product-lid"
          value={lidInput}
          onChange={(event) => setLidInput(event.target.value)}
          required
          maxLength={240}
          pattern="urn:nasa:pds:[A-Za-z0-9._-]+(:[A-Za-z0-9._-]+)*"
          aria-describedby="pds-lid-help"
          autoCapitalize="none"
          spellCheck="false"
        />
        <button type="submit" className="primary" disabled={query.isFetching}>{t('Open archive')}</button>
        <button type="button" className="secondary" onClick={loadExample} disabled={query.isFetching}>{t('Load verified example')}</button>
        <button type="button" className="secondary" onClick={loadCalibratedExample} disabled={query.isFetching}>{t('Load calibrated RIMFAX data')}</button>
      </div>
      <small id="pds-lid-help">{t('Use a bundle, collection, or product LID from the NASA PDS catalog. No keyword results are guessed or substituted.')}</small>
    </form>
    {history.length > 0 && <button type="button" className="pds-back-button" onClick={openParent}><ChevronLeft size={15} aria-hidden="true" />{t('Back to parent archive')}</button>}
    <DataState query={query} label="NASA PDS archive metadata" />
    {product && <div className="pds-product-card">
      <div className="pds-product-heading">
        <span className="space-stat-icon" aria-hidden="true"><Database size={18} /></span>
        <div><p className="eyebrow small-eyebrow">{product.productType.replace('Product_', 'PDS ')}</p><h3>{product.title}</h3></div>
      </div>
      <dl className="pds-product-details">
        <div><dt>{t('Product LID')}</dt><dd><code>{product.lid}</code></dd></div>
        {product.version && <div><dt>{t('Version')}</dt><dd>{product.version}</dd></div>}
        {(product.startDate || product.stopDate) && <div><dt>{t('Archive time coverage')}</dt><dd>{product.startDate?.slice(0, 10) || t('Not provided')}{product.stopDate ? ` – ${product.stopDate.slice(0, 10)}` : ''}</dd></div>}
        {product.updatedAt && <div><dt>{t('Registry update')}</dt><dd><time dateTime={product.updatedAt}>{product.updatedAt.slice(0, 10)} UTC</time></dd></div>}
      </dl>
      {product.labelUrl && <a className="pds-label-link" href={product.labelUrl} target="_blank" rel="noreferrer">{t('Open PDS product label')} <ArrowUpRight size={13} aria-hidden="true" /></a>}
      {product.productType === 'Product_Observational' && <section className="pds-decode-panel" aria-labelledby="pds-decode-title">
        <div className="pds-decode-heading"><div><h3 id="pds-decode-title">{t('Decode archived observation data')}</h3><p>{t('Only PDS4 delimited tables and supported repeated numeric sample arrays are decoded. The request fetches this product’s provider-published label and data file.')}</p></div><button type="button" className="primary" onClick={() => setDecodeRequested(true)} disabled={decoded.isFetching}>{decoded.isFetching ? t('Decoding…') : decoded.data ? t('Refresh decoded data') : t('Decode product')}</button></div>
        {decodeRequested && <DataState query={decoded} label="PDS observation table" />}
        {decoded.data && <div className="pds-decoded-results">
          <p className="space-provenance">{t('{count} matching records · showing {shown} · retrieved {time}.').replace('{count}', decoded.data.recordCount.toLocaleString(locale)).replace('{shown}', decoded.data.returnedCount.toLocaleString(locale)).replace('{time}', new Date(decoded.data.retrievedAt).toLocaleString(locale))}</p>
          {decoded.data.availableRecordTypes.length > 0 && <label className="record-type-control" htmlFor="pds-record-type">{t('Record type from the PDS label')}
            <select id="pds-record-type" value={decodeRecordType} onChange={(event) => setDecodeRecordType(event.target.value)} aria-label="Filter decoded PDS records by record type">
              <option value="">{t('Label default')}{decoded.data.selectedRecordType !== null ? ` (${decoded.data.selectedRecordType})` : ''}</option>
              {decoded.data.availableRecordTypes.map((type) => <option key={type.value} value={type.value}>{type.value} · {type.label}</option>)}
            </select>
          </label>}
          {decoded.data.kind === 'sample-series' ? <div className="pds-sample-grid">{decoded.data.rows.map((row) => <figure className="pds-sample-chart" key={row.recordNumber}>
            <figcaption>{t('Record')} {row.recordNumber}{row.timeUtc ? ` · ${row.timeUtc} UTC` : ''} · {row.sampleCount.toLocaleString(locale)} {t('source samples')}{row.sampleInterval !== null ? ` · Δt ${formatValue(row.sampleInterval, 6)} ${row.sampleIntervalUnit || ''}` : ''}</figcaption>
            <div className="space-chart-canvas"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={row.samples} margin={{ top: 8, right: 12, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="rgba(190,216,224,.11)" strokeDasharray="3 3" />
                <XAxis dataKey="sampleIndex" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#405157' }} />
                <YAxis tick={{ fill: '#9aabad', fontSize: 10 }} tickLine={false} axisLine={false} width={58} />
                <Tooltip contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.2)', borderRadius: 6, color: '#e9f0f4' }} formatter={(value) => [`${formatValue(Number(value), 4)} ${row.sampleUnit || ''}`, t('Archived sample')]} labelFormatter={(value) => `${t('Source sample')} ${value}`} />
                <Line type="linear" dataKey="amplitude" name="Archived sample" stroke="#8bd6db" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer></div>
            <p>{t('Source samples are shown at every {stride} sample(s) for display. Indices and values come from the PDS table; no interpolation is applied.').replace('{stride}', String(row.sampleStride))}</p>
          </figure>)}</div> : <div className="space-table-scroll">
            <table className="space-data-table"><caption>{t('Decoded PDS4 fields and values')}</caption><thead><tr>{decoded.data.schema.slice(0, 12).map((field) => <th scope="col" key={field.name}>{field.name}{field.unit ? ` (${field.unit})` : ''}</th>)}</tr></thead>
              <tbody>{decoded.data.rows.map((row, index) => <tr key={row.record_number ?? index}>{decoded.data.schema.slice(0, 12).map((field) => <td key={field.name}>{String(row[field.name] ?? 'Unavailable')}</td>)}</tr>)}</tbody>
            </table>
            {decoded.data.schema.length > 12 && <p className="space-provenance">{t('Showing the first 12 of {count} decoded fields.').replace('{count}', String(decoded.data.schema.length))}</p>}
          </div>}
          <p className="space-partial-note">{decoded.data.limitations} <a href={decoded.data.dataUrl} target="_blank" rel="noreferrer">{t('Open source data file')} <ArrowUpRight size={12} aria-hidden="true" /></a></p>
        </div>}
      </section>}
      {canBrowseMembers && <div className="pds-members-heading">
        <h3>{t('Archive members')}</h3>
        <span>{members.total.toLocaleString(locale)} {t('catalog records')}</span>
      </div>}
      {canBrowseMembers && members.items.length > 0 && <div className="pds-member-list">
        {members.items.map((item) => <article className="pds-member-card" key={item.lid}>
          <div><span className="pds-member-type">{item.productType.replace('Product_', '')}</span><h4>{item.title}</h4></div>
          <code>{item.lid}</code>
          {item.startDate && <p>{t('Archive time:')} {item.startDate.slice(0, 10)}{item.stopDate ? ` – ${item.stopDate.slice(0, 10)}` : ''}</p>}
          <div className="pds-member-actions">
            <button type="button" className="secondary" onClick={() => openProduct(item)}>{item.productType === 'Product_Bundle' || item.productType === 'Product_Collection' ? t('Browse members') : t('Inspect record')} <ArrowUpRight size={13} aria-hidden="true" /></button>
            {item.labelUrl && <a href={item.labelUrl} target="_blank" rel="noreferrer">{t('PDS label')} <ArrowUpRight size={13} aria-hidden="true" /></a>}
          </div>
        </article>)}
      </div>}
      {canBrowseMembers && members.items.length === 0 && <p className="space-empty">{members.total === 0 ? t('NASA PDS reports no child records for this archive product.') : t('No records were returned for this page. Go back or retry the archive request.')}</p>}
      {canBrowseMembers && members.total > 0 && <div className="pds-pagination">
        <button type="button" className="secondary" onClick={openPreviousPage} disabled={pageCursors.length === 1 || query.isFetching}><ChevronLeft size={15} aria-hidden="true" />{t('Previous')}</button>
        <span>{t('Page {page} · {shown} shown · {total} total').replace('{page}', String(pageCursors.length)).replace('{shown}', String(members.items.length)).replace('{total}', members.total.toLocaleString(locale))}</span>
        <button type="button" className="secondary" onClick={openNextPage} disabled={!members.nextCursor || query.isFetching}>{t('Next')}<ChevronRight size={15} aria-hidden="true" /></button>
      </div>}
      <p className="space-provenance">{t('Retrieved')} {new Date(data.retrievedAt).toLocaleString(locale)}. {t('Archive timestamps and product versions come from NASA PDS Registry metadata; measurements are available only after a supported product is explicitly decoded.')}</p>
    </div>}
  </section>;
}

export default function SpaceExplorerPage({ locale = 'en-US' }) {
  const t = (source) => translate(locale, source);
  return <SpaceLocaleContext.Provider value={locale}><main className="page space-explorer-page">
    <header className="page-header">
      <p className="eyebrow">{t('Earth · atmosphere · heliosphere · solar system')}</p>
      <h1>{t('Space & Atmosphere Explorer')}</h1>
      <p>{t('Explore atmosphere models, space-weather observations, solar-system positions, exoplanet catalog records, and decoded planetary mission data—with sources, timestamps, and limitations alongside the results.')}</p>
    </header>
    <nav className="space-jump-links" aria-label={t('Space Explorer sections')}>
      <a href="#space-atmosphere-title">{t('Atmosphere')}</a>
      <a href="#space-weather-title">{t('Space weather')}</a>
      <a href="#space-neo-title">{t('Asteroid approaches')}</a>
      <a href="#space-sky-title">{t('Sky geometry')}</a>
      <a href="#space-exoplanets-title">{t('Exoplanets')}</a>
      <a href="#space-pds-title">{t('Mission archives')}</a>
    </nav>
    <AtmospherePanel />
    <SpaceWeatherPanel />
    <NearEarthObjectsPanel />
    <SpaceVisibilityPanel />
    <ExoplanetCatalogPanel />
    <PlanetaryArchivePanel />
    <aside className="space-scope-note" aria-labelledby="space-scope-title">
      <h2 id="space-scope-title">{t('Scope and scientific limits')}</h2>
      <p>{t('This release connects a reference atmosphere model, selected NOAA SWPC products, NASA/JPL close-approach predictions, locally calculated solar-system positions, NASA Exoplanet Archive catalog records, and supported PDS4 delimited science products. Sky output is geometric, not a guarantee of actual visibility; exoplanet data is a specific catalog, not all deep-space objects. PDS decoding is limited to declared table layouts and rejects unsupported formats. No unavailable measurements or impact probabilities are substituted.')}</p>
    </aside>
  </main></SpaceLocaleContext.Provider>;
}
