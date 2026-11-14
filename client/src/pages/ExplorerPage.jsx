import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, CloudSun, Globe2, Info, MapPin, RefreshCw, Search } from 'lucide-react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './ExplorerPage.css';
import useCurrentLocation from '../hooks/useCurrentLocation.js';
import { fetchWeather } from '../api/weather.js';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

const PLACE_PRESETS = [
  { name: 'Whole Earth', longitude: 10, latitude: 15, height: 4_000_000 },
  { name: 'Karachi', longitude: 67.01, latitude: 24.86, height: 1_500_000 },
  { name: 'London', longitude: -0.13, latitude: 51.51, height: 1_500_000 },
  { name: 'New York', longitude: -74.01, latitude: 40.71, height: 1_500_000 },
  { name: 'Tokyo', longitude: 139.69, latitude: 35.68, height: 1_500_000 },
  { name: 'Nairobi', longitude: 36.82, latitude: -1.29, height: 1_500_000 },
  { name: 'Sydney', longitude: 151.21, latitude: -33.87, height: 1_500_000 },
];

export default function ExplorerPage({ locale = 'en-US' }) {
  const t = (source) => translate(locale, source);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const ozoneLayerRef = useRef(null);
  const searchControllerRef = useRef(null);
  const [showOzone, setShowOzone] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeSearchError, setPlaceSearchError] = useState('');
  const [placeSearchStatus, setPlaceSearchStatus] = useState('');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState(null);
  const currentLocation = useCurrentLocation();
  const mapLocation = searchedLocation || currentLocation.location;
  const ozone = useQuery({
    queryKey: ['nasa-gibs-ozone'],
    queryFn: async () => {
      const response = await apiFetch('/api/earth/ozone');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'NASA ozone layer metadata is unavailable.');
      return data;
    },
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
  const weather = useQuery({
    queryKey: ['weather', mapLocation],
    queryFn: () => fetchWeather(mapLocation),
    enabled: Boolean(mapLocation),
    retry: 1,
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
  });
  const earthquakes = useQuery({
    queryKey: ['explorer-earthquakes'],
    queryFn: async () => {
      const response = await apiFetch('/api/events?feed=all_day&limit=100');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'USGS earthquake reports are unavailable.');
      return data;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: 1,
  });

  useEffect(() => () => searchControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let viewer;
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: true,
        geocoder: false,
        homeButton: true,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: true,
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }),
        ),
      });
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(10, 15, 4_000_000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      });
      viewer.scene.globe.enableLighting = true;
      viewerRef.current = viewer;
      const canvas = viewer.scene.canvas;
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-label', '3D Earth map. Use the home and full-screen controls, or open the guided change analysis for a table-based alternative.');
      setMapReady(true);
    } catch {
      setMapError('The interactive globe could not start. You can still explore changes with the table-based analysis below.');
    }
    return () => { viewerRef.current = null; if (viewer && !viewer.isDestroyed()) viewer.destroy(); };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!showOzone || !ozone.data || !viewer || viewer.isDestroyed()) return undefined;
    try {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: ozone.data.tileUrlTemplate,
        maximumLevel: 6,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        credit: new Cesium.Credit('NASA GIBS · Aura OMI'),
      });
      const layer = viewer.imageryLayers.addImageryProvider(provider, 1);
      layer.alpha = 0.78;
      ozoneLayerRef.current = layer;
      setMapError('');
      return () => {
        if (!viewer.isDestroyed() && viewer.imageryLayers.contains(layer)) viewer.imageryLayers.remove(layer, true);
        if (ozoneLayerRef.current === layer) ozoneLayerRef.current = null;
      };
    } catch (error) {
      setMapError(`NASA ozone imagery could not be displayed: ${error.message}`);
      return undefined;
    }
  }, [showOzone, ozone.data, mapReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const location = mapLocation;
    if (!viewer || viewer.isDestroyed() || !location) return;

    const position = Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude);
    const previousMarker = viewer.entities.getById('terra-current-location');
    if (previousMarker) viewer.entities.remove(previousMarker);
    viewer.entities.add({
      id: 'terra-current-location',
      name: location.name || 'Selected location',
      position,
      point: {
        pixelSize: 13,
        color: Cesium.Color.fromCssColorString('#c3e889'),
        outlineColor: Cesium.Color.fromCssColorString('#081116'),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: location.name || (searchedLocation ? 'Selected place' : 'Your location'),
        font: '13px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#081116'),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude, 250_000),
      duration: 1.2,
    });
  }, [mapLocation, searchedLocation, mapReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!mapReady || !viewer || viewer.isDestroyed() || !earthquakes.data) return;
    for (const entity of [...viewer.entities.values]) {
      if (entity.id?.startsWith('terra-earthquake-')) viewer.entities.remove(entity);
    }
    for (const event of earthquakes.data.events) {
      const [longitude, latitude] = event.coordinates;
      const magnitude = Number.isFinite(event.magnitude) ? event.magnitude : null;
      viewer.entities.add({
        id: `terra-earthquake-${event.id}`,
        name: `USGS earthquake report${magnitude === null ? '' : `, magnitude ${magnitude.toFixed(1)}`}`,
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
        point: {
          pixelSize: magnitude === null ? 7 : Math.max(7, Math.min(18, 5 + magnitude * 1.5)),
          color: Cesium.Color.fromCssColorString('#f0a36f'),
          outlineColor: Cesium.Color.fromCssColorString('#081116'),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  }, [earthquakes.data, mapReady]);

  const requestCurrentLocation = async () => {
    setSearchedLocation(null);
    await currentLocation.requestLocation();
  };

  const searchPlaces = async (event) => {
    event.preventDefault();
    searchControllerRef.current?.abort();
    searchControllerRef.current = null;
    const query = placeQuery.trim();
    if (query.length < 2) {
      setSearchingPlaces(false);
      setPlaceSearchError('Enter at least two characters to search for a place.');
      setPlaceResults([]);
      return;
    }
    const controller = new AbortController();
    searchControllerRef.current = controller;
    setSearchingPlaces(true);
    setPlaceSearchError('');
    setPlaceSearchStatus('');
    setPlaceResults([]);
    try {
      const response = await apiFetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Place search is unavailable.');
      setPlaceResults(data.results);
      setPlaceSearchStatus(data.results.length ? `${data.results.length} matching places. Select one to move the map.` : 'No matching places were found.');
    } catch (error) {
      if (error.name !== 'AbortError') setPlaceSearchError(error.message || 'Place search is unavailable.');
    } finally {
      if (searchControllerRef.current === controller) {
        searchControllerRef.current = null;
        setSearchingPlaces(false);
      }
    }
  };

  const selectPlace = (place) => {
    setSearchedLocation(place);
    setPlaceResults([]);
    setPlaceSearchStatus(`${place.name}${place.region ? `, ${place.region}` : ''} ${t('selected.')}`);
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(place.longitude, place.latitude, 250_000),
        duration: 1.2,
      });
    }
  };

  return <main className="page explorer-page">
    <header className="page-header">
      <p className="eyebrow">{t('Planetary explorer')}</p>
      <h1>{t('Explore Earth')}</h1>
      <p>{t('Rotate and zoom a geographic globe. Turn on NASA satellite-derived total-column ozone imagery for the latest date advertised by the source.')}</p>
    </header>
    <div className="map-location-control">
      <label htmlFor="map-place">{t('Jump to a place')}</label>
      <select id="map-place" defaultValue="Whole Earth" onChange={(event) => { const place = PLACE_PRESETS.find((item) => item.name === event.target.value); if (place && viewerRef.current) viewerRef.current.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(place.longitude, place.latitude, place.height), duration: 1.2 }); }}>
        <option value="Whole Earth">{t('Whole Earth')}</option>
        {PLACE_PRESETS.slice(1).map((place) => <option key={place.name} value={place.name}>{place.name}</option>)}
      </select>
      <form className="map-place-search" onSubmit={searchPlaces}>
        <label className="visually-hidden" htmlFor="map-place-search">{t('Search for a place')}</label>
        <input id="map-place-search" type="search" value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} maxLength={100} placeholder={t('Search any city or place')} />
        <button type="submit" className="secondary" disabled={searchingPlaces}><Search size={15} aria-hidden="true" />{searchingPlaces ? t('Searching…') : t('Search')}</button>
      </form>
      <button type="button" className="secondary location-button" onClick={requestCurrentLocation} disabled={currentLocation.status === 'loading'}>
        <MapPin size={16} aria-hidden="true" />{currentLocation.status === 'loading' ? t('Finding location…') : t('Use my location')}
      </button>
      <button type="button" className={`secondary ozone-toggle${showOzone ? ' selected' : ''}`} aria-pressed={showOzone} onClick={() => setShowOzone((visible) => !visible)}>
        {showOzone ? t('Hide NASA ozone layer') : t('Show NASA ozone layer')}
      </button>
      <span>{t('Location is requested only when you choose this button and is not saved.')}</span>
    </div>
    <p className="map-search-note">{t("Submitting a place search sends that text to Open-Meteo's geocoding service. Results use GeoNames place data and may be approximate.")}</p>
    {placeSearchError && <p className="location-error" role="alert">{placeSearchError}</p>}
    {placeSearchStatus && <p className="map-search-status" role="status" aria-live="polite">{placeSearchStatus}</p>}
    {placeResults.length > 0 && <ul className="map-place-results" aria-label={t('Place search results')}>
      {placeResults.map((place) => <li key={place.id}><button type="button" onClick={() => selectPlace(place)}><strong>{place.name}</strong>{place.region && <span>{place.region}</span>}</button></li>)}
    </ul>}
    {showOzone && <section className="ozone-layer-info" aria-live="polite">
      {ozone.isLoading && <p role="status">{t('Checking NASA GIBS for the latest available ozone-image date…')}</p>}
      {ozone.error && <div role="alert"><span>{ozone.error.message}</span><button type="button" className="secondary" onClick={() => ozone.refetch()}>{t('Retry ozone metadata')}</button></div>}
      {ozone.data && <>
        <p><strong>{ozone.data.product}</strong> · {t('Image date:')} <time dateTime={ozone.data.observationDate}>{ozone.data.observationDate}</time> · NASA GIBS</p>
        <p>{ozone.data.dataType} {ozone.data.limitation}</p>
        <a href={ozone.data.sourceUrl} target="_blank" rel="noreferrer">{t('NASA Aura OMI source details')}</a>
      </>}
    </section>}
    {currentLocation.error && <p className="location-error" role="alert">{currentLocation.error}</p>}
    {mapError && <p className="analysis-state analysis-error" role="status"><Info size={18} />{mapError}</p>}
    <section className="map-earthquake-layer" aria-labelledby="map-earthquakes-title">
      <div><p className="eyebrow small-eyebrow">{t('OBSERVED CATALOG REPORTS · NOT PREDICTIONS')}</p><h2 id="map-earthquakes-title">{t('Recent earthquakes')}</h2></div>
      {earthquakes.isLoading && <p role="status">{t('Loading the latest USGS reports…')}</p>}
      {earthquakes.error && <div role="alert"><span>{earthquakes.error.message}</span><button type="button" className="secondary" onClick={() => earthquakes.refetch()}>{t('Retry')}</button></div>}
      {earthquakes.data && <>
        <p>{t('USGS ComCat · {count} events in the past day · retrieved {time}. Map points and magnitudes are catalog reports; earthquakes are not predicted.').replace('{count}', String(earthquakes.data.count)).replace('{time}', new Date(earthquakes.data.retrievalTime).toLocaleString(locale))}</p>
        {earthquakes.data.events.length === 0 ? <p>{t('No events are reported in this feed.')}</p> : <ul>{earthquakes.data.events.slice(0, 5).map((item) => <li key={item.id}><a href={item.detailUrl || 'https://earthquake.usgs.gov/earthquakes/map/'} target="_blank" rel="noreferrer"><strong>{item.magnitude === null ? t('Magnitude unavailable') : `M ${item.magnitude.toFixed(1)}`}</strong><span>{item.place}</span></a><time dateTime={item.time}>{new Date(item.time).toLocaleString(locale)}</time></li>)}</ul>}
        <Link to="/events">{t('Open the full USGS earthquake feed')} <ArrowRight size={14} aria-hidden="true" /></Link>
      </>}
    </section>
    <div ref={containerRef} className="cesium-container" aria-describedby="globe-help" />
    <p id="globe-help" className="map-help">{t('Base map tiles ©')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. {t('Ozone overlay ©')} <a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA EOSDIS GIBS</a>. {t('Ozone image colors are for spatial visualization only; use the stated product date and source. If the globe is not usable for you, the comparison tool provides plain-language results and a data table.')}</p>
    {mapLocation && <section className="map-weather-panel" aria-labelledby="local-weather-title">
      <div className="map-weather-heading">
      <div><p className="eyebrow small-eyebrow">{t('SELECTED PLACE · OPEN-METEO')}</p><h2 id="local-weather-title">{t('Local weather')}</h2></div>
        <CloudSun size={24} aria-hidden="true" />
      </div>
      {weather.isLoading && <p className="feed-state" role="status" aria-live="polite"><RefreshCw size={16} className="spin" aria-hidden="true" /> {t('Loading weather for {latitude}, {longitude}…').replace('{latitude}', mapLocation.latitude.toFixed(3)).replace('{longitude}', mapLocation.longitude.toFixed(3))}</p>}
      {weather.error && <div className="location-error" role="alert"><span>{weather.error.message}</span><button type="button" className="secondary" onClick={() => weather.refetch()}>{t('Retry weather')}</button></div>}
      {weather.data && <div className="map-weather-details">
        <strong>{weather.data.current?.temperature_2m ?? t('Unavailable')}<span>{weather.data.current_units?.temperature_2m || '°C'}</span></strong>
        <dl>
          <div><dt>{t('Feels like')}</dt><dd>{weather.data.current?.apparent_temperature ?? t('Unavailable')} {weather.data.current_units?.apparent_temperature || '°C'}</dd></div>
          <div><dt>{t('Humidity')}</dt><dd>{weather.data.current?.relative_humidity_2m ?? t('Unavailable')}{weather.data.current_units?.relative_humidity_2m || '%'}</dd></div>
          <div><dt>{t('Wind speed')}</dt><dd>{weather.data.current?.wind_speed_10m ?? t('Unavailable')} {weather.data.current_units?.wind_speed_10m || 'km/h'}</dd></div>
          <div><dt>{t('Precipitation, previous hour')}</dt><dd>{weather.data.current?.precipitation ?? t('Unavailable')} {weather.data.current_units?.precipitation || 'mm'}</dd></div>
        </dl>
        <p>{mapLocation.name || t('Selected place')} · {t('Coordinates:')} {mapLocation.latitude.toFixed(4)}, {mapLocation.longitude.toFixed(4)}. {t('Provider time:')} {weather.data.current?.time || t('Unavailable')} {weather.data.timezone_abbreviation || ''}. {t('Retrieved:')} {new Date(weather.data.retrievalTime).toLocaleString(locale)}. {weather.data.source} {t('forecast-model output; not a direct observation.')}</p>
        <Link className="map-weather-analysis-link" to="/weather" state={{ weatherLocation: { name: mapLocation.name || 'Selected place', ...mapLocation } }}>{t('Open hourly graphs and scientific weather explanation')} <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>}
    </section>}
    <section className="map-alternative" aria-labelledby="map-alternative-title"><span className="map-alternative-icon"><Globe2 size={20} aria-hidden="true" /></span><div><h2 id="map-alternative-title">{t('Prefer a table to a map?')}</h2><p>{t('Compare real NASA POWER data across places, read the trend in plain language, and open every plotted value as a table. The analysis does not depend on interacting with this globe.')}</p><Link to="/trend">{t('Open the guided change analysis')} <ArrowRight size={15} aria-hidden="true" /></Link></div></section>
  </main>;
}
