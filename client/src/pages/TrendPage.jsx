import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Download, Info, LoaderCircle, Mic, MicOff, RotateCcw } from 'lucide-react';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

async function getJson(url) {
  const response = await apiFetch(url);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'The data source could not complete this request.');
  return result;
}

const COLORS = ['#c3e889', '#8bd6db', '#e6b77e', '#d19bf0', '#f28e85', '#7ea9f3'];
const currentYear = new Date().getFullYear();
const VARIABLE_GUIDANCE = {
  T2M: 'Average near-surface air temperature: is the air getting warmer or cooler?',
  T2M_MAX: 'Average monthly daily high temperature: are typical daytime highs rising or falling?',
  T2M_MIN: 'Average monthly daily low temperature: are typical overnight lows rising or falling?',
  PRECTOTCORR: 'Corrected precipitation rate: is rainfall getting heavier or lighter on average?',
  RH2M: 'Relative humidity: is the air becoming more or less humid?',
  QV2M: 'Specific humidity: how much water vapor is mixed into the air?',
  WS10M: 'Wind speed at 10 m: are average winds getting faster or slower?',
  ALLSKY_SFC_SW_DWN: 'Incoming shortwave solar energy at the surface under all-sky conditions.',
  ALLSKY_SFC_LW_DWN: 'Incoming longwave atmospheric radiation at the surface under all-sky conditions.',
};

function recommendVariable(question) {
  const text = question.toLocaleLowerCase();
  if (/temperature|warming|warmer|cooler|heat|temp\b|taap|darja[- ]?hararat|\u062f\u0631\u062c\u06c1 \u062d\u0631\u0627\u0631\u062a/u.test(text)) return 'T2M';
  if (/precipitation|rainfall|rain|rainy|barish|baarish|\u0628\u0627\u0631\u0634/u.test(text)) return 'PRECTOTCORR';
  if (/humidity|humid|moisture|nami|\u0646\u0645\u06cc/u.test(text)) return 'RH2M';
  if (/wind|winds|hawa|\u06c1\u0648\u0627/u.test(text)) return 'WS10M';
  return null;
}

function getDirectionSummary(results, variableLabel) {
  const increasing = results.filter((item) => item.analysis.direction === 'increasing').map((item) => item.region.name);
  const decreasing = results.filter((item) => item.analysis.direction === 'decreasing').map((item) => item.region.name);
  const stable = results.filter((item) => item.analysis.direction === 'stable').map((item) => item.region.name);
  if (increasing.length && decreasing.length) return `${variableLabel} moves in opposite directions: increasing in ${increasing.join(', ')} and decreasing in ${decreasing.join(', ')}.${stable.length ? ` No clear slope in ${stable.join(', ')}.` : ''}`;
  if (increasing.length) return `${variableLabel} is increasing in ${increasing.join(', ')}.${stable.length ? ` No clear slope in ${stable.join(', ')}.` : ''}`;
  if (decreasing.length) return `${variableLabel} is decreasing in ${decreasing.join(', ')}.${stable.length ? ` No clear slope in ${stable.join(', ')}.` : ''}`;
  return `No clear upward or downward slope was estimated for ${variableLabel} in these locations.`;
}

export default function TrendPage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const [variable, setVariable] = useState('T2M');
  const [startYear, setStartYear] = useState(Math.max(1981, currentYear - 10));
  const [endYear, setEndYear] = useState(currentYear - 1);
  const [regionIds, setRegionIds] = useState(['nyc', 'amazon', 'sahel', 'greenland']);
  const [customLocations, setCustomLocations] = useState([]);
  const [pointName, setPointName] = useState('');
  const [pointLatitude, setPointLatitude] = useState('');
  const [pointLongitude, setPointLongitude] = useState('');
  const [areaName, setAreaName] = useState('');
  const [areaSouth, setAreaSouth] = useState('');
  const [areaNorth, setAreaNorth] = useState('');
  const [areaWest, setAreaWest] = useState('');
  const [areaEast, setAreaEast] = useState('');
  const [question, setQuestion] = useState('');
  const [speechLanguage, setSpeechLanguage] = useState('en-US');
  const [speechMessage, setSpeechMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const recognitionRef = useRef(null);

  const catalog = useQuery({ queryKey: ['change-catalog'], queryFn: () => getJson('/api/variables'), staleTime: Infinity, retry: 1 });
  const selectedVariable = catalog.data?.variables.find((item) => item.id === variable);
  const minimumYear = selectedVariable?.startYear || 1981;
  const selectedLocationCount = regionIds.length + customLocations.length;
  const pointInputValid = pointName.trim().length > 0
    && pointLatitude !== '' && pointLongitude !== ''
    && Number.isFinite(Number(pointLatitude)) && Number.isFinite(Number(pointLongitude))
    && Number(pointLatitude) >= -90 && Number(pointLatitude) <= 90
    && Number(pointLongitude) >= -180 && Number(pointLongitude) <= 180;
  const areaInputValid = areaName.trim().length > 0
    && [areaSouth, areaNorth, areaWest, areaEast].every((value) => value !== '' && Number.isFinite(Number(value)))
    && Number(areaSouth) >= -90 && Number(areaNorth) <= 90
    && Number(areaWest) >= -180 && Number(areaEast) <= 180
    && Number(areaNorth) > Number(areaSouth) && Number(areaEast) > Number(areaWest)
    && Number(areaNorth) - Number(areaSouth) <= 5
    && Number(areaEast) - Number(areaWest) <= 5;
  const recommendation = recommendVariable(question);
  const periodError = !Number.isInteger(startYear) || !Number.isInteger(endYear)
    ? 'Enter whole calendar years.'
    : startYear < minimumYear
      ? `The selected variable record starts in ${minimumYear}.`
      : startYear > currentYear - 2 || endYear > currentYear - 1
        ? `Choose a period ending no later than ${currentYear - 1}.`
        : endYear < startYear
          ? 'The end year must be the same as or later than the start year.'
          : endYear - startYear < 9
            ? 'Choose at least 10 years.'
            : '';
  const canAnalyze = !periodError && selectedLocationCount >= 1 && Boolean(catalog.data);
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const analysis = useQuery({
    queryKey: ['change-analysis', submitted],
    queryFn: () => {
      const { runId: _runId, question: _question, ...filters } = submitted;
      const params = new URLSearchParams({
        variable: filters.variable,
        startYear: String(filters.startYear),
        endYear: String(filters.endYear),
        locations: JSON.stringify(filters.locations),
      });
      return getJson(`/api/change-analysis?${params}`);
    },
    enabled: Boolean(submitted),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const combinedChart = useMemo(() => {
    if (!analysis.data) return [];
    const byYear = new Map();
    analysis.data.results.forEach(({ region, analysis: result }) => result.observations.forEach(({ year, value }) => {
      if (!byYear.has(year)) byYear.set(year, { year });
      byYear.get(year)[region.id] = value;
    }));
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }, [analysis.data]);

  useEffect(() => () => { try { recognitionRef.current?.abort?.(); } catch { /* Recognition may already have stopped. */ } }, []);

  const changeVariable = (next) => {
    const nextMinimumYear = catalog.data?.variables.find((item) => item.id === next)?.startYear || 1981;
    setVariable(next);
    setStartYear((current) => Math.max(current, nextMinimumYear));
    setSubmitted(null);
  };
  const changePeriod = (start, end) => { setStartYear(start); setEndYear(end); setSubmitted(null); };
  const toggleRegion = (id) => {
    setRegionIds((chosen) => chosen.includes(id)
      ? chosen.filter((item) => item !== id)
      : chosen.length + customLocations.length < 6 ? [...chosen, id] : chosen);
    setSubmitted(null);
  };
  const addCustomPoint = () => {
    const latitude = Number(pointLatitude);
    const longitude = Number(pointLongitude);
    if (!pointName.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
      || selectedLocationCount >= 6) return;
    setCustomLocations((items) => [...items, {
      type: 'point',
      id: `custom-point-${Date.now()}`,
      name: pointName.trim(),
      latitude,
      longitude,
    }]);
    setPointName('');
    setPointLatitude('');
    setPointLongitude('');
    setSubmitted(null);
  };
  const addAreaBox = () => {
    const minLatitude = Number(areaSouth);
    const maxLatitude = Number(areaNorth);
    const minLongitude = Number(areaWest);
    const maxLongitude = Number(areaEast);
    if (!areaName.trim() || ![minLatitude, maxLatitude, minLongitude, maxLongitude].every(Number.isFinite)
      || minLatitude < -90 || maxLatitude > 90 || minLongitude < -180 || maxLongitude > 180
      || maxLatitude <= minLatitude || maxLongitude <= minLongitude
      || maxLatitude - minLatitude > 5 || maxLongitude - minLongitude > 5
      || selectedLocationCount >= 6) return;
    setCustomLocations((items) => [...items, {
      type: 'area',
      id: `custom-area-${Date.now()}`,
      name: areaName.trim(),
      minLatitude,
      maxLatitude,
      minLongitude,
      maxLongitude,
    }]);
    setAreaName('');
    setAreaSouth('');
    setAreaNorth('');
    setAreaWest('');
    setAreaEast('');
    setSubmitted(null);
  };
  const removeCustomLocation = (id) => {
    setCustomLocations((items) => items.filter((item) => item.id !== id));
    setSubmitted(null);
  };
  const startDictation = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage('Voice entry is not available in this browser. You can use your device’s dictation tool, or skip the question and choose an analysis below.');
      return;
    }
    recognitionRef.current?.stop?.();
    try {
      const recognition = new Recognition();
      recognition.lang = speechLanguage;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => { setIsListening(true); setSpeechMessage('Listening. Speak your question now.'); };
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setQuestion((previous) => [previous, transcript].filter(Boolean).join(' '));
          setSubmitted(null);
          setSpeechMessage(`Added: “${transcript}”. Review the text before continuing.`);
        }
      };
      recognition.onerror = (event) => setSpeechMessage(event.error === 'not-allowed' ? 'Microphone permission was not granted. You can still choose an analysis without entering a question.' : 'Voice entry stopped. You can retry or continue without a question.');
      recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechMessage('Voice entry could not start. Try your device dictation, or continue without a question.');
    }
  };

  const stopDictation = () => recognitionRef.current?.stop?.();
  const applyRecommendation = () => { if (recommendation) changeVariable(recommendation); };
  const submitAnalysis = (event) => {
    event.preventDefault();
    if (!canAnalyze || analysis.isFetching) return;
    const presetLocations = regionIds.map((id) => ({ type: 'point', ...catalog.data.regions.find((region) => region.id === id) }));
    setSubmitted({
      variable,
      startYear,
      endYear,
      locations: [...presetLocations, ...customLocations],
      question: question.trim(),
      runId: Date.now(),
    });
  };

  const setPresetPeriod = (years) => changePeriod(years === 'full' ? minimumYear : Math.max(minimumYear, currentYear - years), currentYear - 1);
  const exportCsv = () => {
    if (!analysis.data) return;
    const rows = [[
      'location', 'location_type', 'year', 'value', 'unit', 'valid_months',
      'area_coverage_percent', 'spatial_support', 'source_products',
      'data_retrieved_at', 'research_question',
    ]];
    analysis.data.results.forEach(({ region, analysis: result, dataRetrievedAt, datasetSources }) => {
      result.observations.forEach((point) => rows.push([
        region.name,
        region.type || 'point',
        point.year,
        point.value,
        result.unit,
        point.validMonths,
        point.areaCoverage === null || point.areaCoverage === undefined ? '' : (point.areaCoverage * 100).toFixed(1),
        region.spatialSupport || '',
        (datasetSources || []).join('; '),
        dataRetrievedAt,
        submitted?.question || '',
      ]));
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `terra-${analysis.data.variable.id}-${analysis.data.period.requestedStart}-${analysis.data.period.requestedEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="page change-page">
    <header className="page-header change-header"><p className="eyebrow"><span className="eyebrow-line" /> {t('EARTH CHANGE WORKSPACE')}</p><h1>{t('What is changing on Earth?')}</h1><p>{t('Pick something scientists measure, choose places and years, then compare the evidence. You do not need to know statistics to get started.')}</p></header>

    <form className="analysis-setup" aria-labelledby="setup-title" onSubmit={submitAnalysis}>
      <div className="setup-heading"><span className="step-number" aria-hidden="true">1</span><div><h2 id="setup-title">{t('Choose what to look at')}</h2><p>{t('Select one Earth variable. The short descriptions explain what each one means.')}</p></div></div>

      <fieldset className="variable-picker" aria-describedby="variable-help">
        <legend className="visually-hidden">Earth system variable</legend>
        {catalog.isLoading && <p className="form-hint" role="status">{t('Loading the available variables…')}</p>}
        <div className="variable-options" role="radiogroup" aria-label={t('Earth system variable')}>
          {(catalog.data?.variables || []).map((item) => <label className={`variable-option${variable === item.id ? ' selected' : ''}`} key={item.id}>
            <input type="radio" name="variable" value={item.id} checked={variable === item.id} onChange={() => changeVariable(item.id)} />
            <span className="variable-radio" aria-hidden="true" />
            <span className="variable-card-copy"><strong>{t(item.label)}</strong><small>{t(VARIABLE_GUIDANCE[item.id])}</small><span className="variable-unit">{t('Measured in {unit}', { unit: item.unit })}</span></span>
          </label>)}
        </div>
        <p className="variable-note" id="variable-help">{t('NASA POWER monthly data: {aggregation}. The source product and data type are listed with each result.', { aggregation: selectedVariable?.aggregation || t('monthly archive') })}</p>
      </fieldset>

      <div className="optional-question">
        <label htmlFor="research-question">{t('Optional: what are you curious about?')}</label>
        <p id="question-help">{t('You can leave this blank. You can type, dictate, or skip this question and use the choices below.')}</p>
        <div className="question-input-row"><textarea id="research-question" value={question} maxLength={300} aria-describedby="question-help speech-privacy" placeholder="For example: Is temperature changing differently in the Amazon and Greenland?" onChange={(event) => { setQuestion(event.target.value); setSubmitted(null); }} /><button type="button" className={`voice-button${isListening ? ' listening' : ''}`} onClick={isListening ? stopDictation : startDictation} aria-label={isListening ? 'Stop voice entry' : 'Dictate your question'} aria-pressed={isListening}>{isListening ? <MicOff size={17} /> : <Mic size={17} />}<span>{isListening ? 'Stop' : 'Use voice'}</span></button></div>
        <div className="voice-options"><label htmlFor="voice-language">Voice language</label><select id="voice-language" value={speechLanguage} onChange={(event) => setSpeechLanguage(event.target.value)}><option value="en-US">English</option><option value="ur-PK">Urdu</option></select><span id="speech-privacy">Microphone starts only when you press the button. Your browser may use its own speech service. Voice entry is optional.</span></div><p className="question-privacy">Your question is used only for an on-device keyword suggestion and your CSV export; it is not sent to the analysis API.</p>
        <p className="speech-status" role="status" aria-live="polite">{speechMessage || (!speechSupported ? 'If voice entry is unsupported, use your device’s dictation feature—or continue without typing.' : 'Voice entry works only where your browser supports it and you grant microphone permission.')}</p>
        {recommendation && recommendation !== variable && <div className="question-suggestion" role="status"><span>This question mentions {catalog.data?.variables.find((item) => item.id === recommendation)?.label.toLowerCase()}.</span><button type="button" onClick={applyRecommendation}>Select suggested variable <ArrowRight size={14} /></button><small>Simple keyword suggestion; check that it matches what you meant.</small></div>}
      </div>

      <div className="step-divider" />
      <div className="setup-heading">
        <span className="step-number" aria-hidden="true">2</span>
        <div>
          <h2>Choose where and when</h2>
          <p>Analyze one location or compare several to see whether the trend differs by place.</p>
        </div>
      </div>

      <fieldset className="region-picker">
        <legend>
          {t('Places to compare')} <span>{t('Select one or more, up to six')}</span>
        </legend>
        <p className="location-help">
          {t('Four example places are preselected. Each one represents its nearest NASA model grid point, not a whole country or region.')}
        </p>
        <div className="region-options">
          {(catalog.data?.regions || []).map((region) => (
            <label className={`region-option${regionIds.includes(region.id) ? ' selected' : ''}`} key={region.id}>
              <input
                type="checkbox"
                checked={regionIds.includes(region.id)}
                onChange={() => toggleRegion(region.id)}
              />
              <span className="region-check" aria-hidden="true">
                {regionIds.includes(region.id) ? '✓' : '+'}
              </span>
              <span>
                {t(region.name)}
                <small>{region.latitude.toFixed(2)}°, {region.longitude.toFixed(2)}°</small>
              </span>
            </label>
          ))}
        </div>
        <div className="custom-location-tools">
          <h3>{t('Add a custom point or area')}</h3>
          <p>{t('You can analyze up to six locations at once. Coordinates use decimal degrees.')}</p>
          <div className="custom-location-form">
            <h4>{t('Custom point')}</h4>
            <label>{t('Point name')}<input value={pointName} maxLength={60} onChange={(event) => setPointName(event.target.value)} /></label>
            <label>{t('Latitude')}<input type="number" min="-90" max="90" step="any" value={pointLatitude} onChange={(event) => setPointLatitude(event.target.value)} /></label>
            <label>{t('Longitude')}<input type="number" min="-180" max="180" step="any" value={pointLongitude} onChange={(event) => setPointLongitude(event.target.value)} /></label>
            <button type="button" className="secondary" disabled={!pointInputValid || selectedLocationCount >= 6} onClick={addCustomPoint}>{t('Add point')}</button>
          </div>
          <div className="custom-location-form">
            <h4>{t('Area rectangle')}</h4>
            <p>{t('NASA POWER grid-cell values are area-weighted within this rectangle. Maximum width and height: 5 degrees.')}</p>
            <label>{t('Area name')}<input value={areaName} maxLength={60} onChange={(event) => setAreaName(event.target.value)} /></label>
            <label>{t('South latitude')}<input type="number" min="-90" max="90" step="any" value={areaSouth} onChange={(event) => setAreaSouth(event.target.value)} /></label>
            <label>{t('North latitude')}<input type="number" min="-90" max="90" step="any" value={areaNorth} onChange={(event) => setAreaNorth(event.target.value)} /></label>
            <label>{t('West longitude')}<input type="number" min="-180" max="180" step="any" value={areaWest} onChange={(event) => setAreaWest(event.target.value)} /></label>
            <label>{t('East longitude')}<input type="number" min="-180" max="180" step="any" value={areaEast} onChange={(event) => setAreaEast(event.target.value)} /></label>
            <button type="button" className="secondary" disabled={!areaInputValid || selectedLocationCount >= 6} onClick={addAreaBox}>{t('Add area')}</button>
          </div>
          {customLocations.length > 0 && <ul className="custom-location-list" aria-label={t('Custom locations added')}>
            {customLocations.map((location) => <li key={location.id}>
              <span>{location.name} · {location.type === 'area' ? t('area rectangle') : t('custom point')}</span>
              <button type="button" className="text-button" onClick={() => removeCustomLocation(location.id)}>{t('Remove')}</button>
            </li>)}
          </ul>}
        </div>
      </fieldset>

      <fieldset className="period-picker">
        <legend>Time period</legend>
        <div className="period-presets">
          <button type="button" className={startYear === Math.max(minimumYear, currentYear - 10) && endYear === currentYear - 1 ? 'selected' : ''} onClick={() => setPresetPeriod(10)}>Last 10 years</button>
          <button type="button" className={startYear === Math.max(minimumYear, currentYear - 20) && endYear === currentYear - 1 ? 'selected' : ''} onClick={() => setPresetPeriod(20)}>Last 20 years</button>
          <button type="button" className={startYear === minimumYear && endYear === currentYear - 1 ? 'selected' : ''} onClick={() => setPresetPeriod('full')}>Full available record</button>
        </div>
        <div className="setup-controls">
          <label>From year<input type="number" step="1" min={minimumYear} max={currentYear - 2} value={startYear} onChange={(event) => changePeriod(Number(event.target.value), endYear)} /></label>
          <label>Through year<input type="number" step="1" min={minimumYear + 9} max={currentYear - 1} value={endYear} onChange={(event) => changePeriod(startYear, Number(event.target.value))} /></label>
        </div>
        <p className="form-hint">NASA POWER has monthly historical data. Each year needs at least 10 of 12 valid months; no missing values are invented.</p>
      </fieldset>

      {periodError && <p className="form-hint form-warning" role="alert">{periodError}</p>}
      {selectedLocationCount < 1 && <p className="form-hint form-warning" role="status">{t('Choose at least one place to analyze.')}</p>}
      <div className="analysis-submit-row"><button type="submit" className="primary analyze-button" disabled={!canAnalyze || analysis.isFetching}>{analysis.isFetching ? <LoaderCircle size={17} className="spin" /> : <Activity size={17} />}<span>{analysis.isFetching ? 'Analyzing real observations…' : 'Compare these places'}</span><ArrowRight size={16} /></button><span>Usually takes a few seconds · No account needed</span></div>
    </form>

    {analysis.isFetching && <section className="analysis-state" role="status" aria-live="polite"><LoaderCircle className="spin" size={19} aria-hidden="true" /><div><strong>Retrieving NASA POWER reanalysis and comparing trends</strong><span>Each selected location is analyzed separately. We’ll show which places rise, fall, or have inconclusive evidence.</span></div></section>}
    {analysis.error && <section className="analysis-state analysis-error" role="alert"><Info size={18} aria-hidden="true" /><div><strong>Could not complete this analysis</strong><span>{analysis.error.message}</span><button type="button" onClick={() => analysis.refetch()}><RotateCcw size={13} /> Try again</button></div></section>}
    {analysis.data?.failures?.length > 0 && <section className="analysis-state analysis-error" role="status"><Info size={18} aria-hidden="true" /><div><strong>Some places could not be analyzed</strong><span>{analysis.data.failures.map((failure) => `${failure.region}: ${failure.message}`).join(' ')}</span></div></section>}
    {catalog.error && <section className="analysis-state analysis-error" role="alert"><Info size={18} aria-hidden="true" /><div><strong>Analysis choices could not be loaded</strong><span>{catalog.error.message}</span><button type="button" onClick={() => catalog.refetch()}>Try again</button></div></section>}

    {analysis.data && <>
      <section className="results-intro" aria-labelledby="results-title"><div><p className="eyebrow small-eyebrow">3 · {t('WHAT THE DATA SHOW')}</p><h2 id="results-title">{t(analysis.data.variable.label)} <span>· {analysis.data.variable.unit}</span></h2><p>{analysis.data.period.requestedStart}–{analysis.data.period.requestedEnd} · {analysis.data.source.product}</p></div><button type="button" className="export-button" onClick={exportCsv}><Download size={15} aria-hidden="true" /> {t('Download data as CSV')}</button></section>

      {submitted?.question && <p className="research-question-result"><strong>Your question:</strong> {submitted.question}</p>}
      <section className="plain-language-summary" role="status" aria-live="polite"><span className="summary-icon"><Activity size={19} aria-hidden="true" /></span><div><strong>In simple terms</strong><p>{getDirectionSummary(analysis.data.results, analysis.data.variable.label)} This describes a statistical pattern in this dataset; it does not prove what caused it.</p><small>“Inconclusive” means the test did not find strong enough evidence of a consistent trend. It does not prove that nothing changed.</small></div></section>

      <section className="chart-panel" aria-labelledby="chart-title"><div className="chart-title"><div><h3 id="chart-title">Change over time</h3><p id="chart-help-text">One line per place. Read the table below the chart if a graph is difficult to use.</p></div><span className="chart-unit">{analysis.data.variable.unit}</span></div>
        <p className="visually-hidden" id="chart-description">Annual {analysis.data.variable.label} values, in {analysis.data.variable.unit}, for {analysis.data.results.map((item) => item.region.name).join(', ')} from {analysis.data.period.requestedStart} to {analysis.data.period.requestedEnd}. Exact values are available in the accessible table.</p>
        <div className="change-chart" aria-describedby="chart-help-text chart-description"><ResponsiveContainer width="100%" height="100%"><LineChart accessibilityLayer data={combinedChart} margin={{ top: 10, right: 18, left: 0, bottom: 2 }}><CartesianGrid stroke="rgba(190,216,224,.16)" vertical={false} /><XAxis dataKey="year" tick={{ fill: '#a6b8ba', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(190,216,224,.3)' }} minTickGap={35} /><YAxis width={62} tick={{ fill: '#a6b8ba', fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} /><Tooltip contentStyle={{ background: '#101b21', border: '1px solid rgba(190,216,224,.3)', borderRadius: 7, fontSize: 12 }} labelStyle={{ color: '#e9f0f4' }} formatter={(value, name) => [`${Number(value).toFixed(2)} ${analysis.data.variable.unit}`, analysis.data.results.find((item) => item.region.id === name)?.region.name || name]} /><Legend formatter={(value) => analysis.data.results.find((item) => item.region.id === value)?.region.name || value} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />{analysis.data.results.map(({ region }, index) => <Line key={region.id} type="linear" dataKey={region.id} name={region.id} stroke={COLORS[index % COLORS.length]} strokeWidth={2.5} connectNulls={false} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />)}</LineChart></ResponsiveContainer></div>
        <details className="plot-data-panel"><summary>Show the exact chart values as a table</summary><div className="result-table-wrap"><table className="result-table plot-data-table"><caption className="visually-hidden">Annual {analysis.data.variable.label} values for each plotted location</caption><thead><tr><th scope="col">Year</th>{analysis.data.results.map(({ region }) => <th scope="col" key={region.id}>{region.name} ({analysis.data.variable.unit})</th>)}</tr></thead><tbody>{combinedChart.map((row) => <tr key={row.year}><th scope="row">{row.year}</th>{analysis.data.results.map(({ region }) => <td key={region.id}>{Number.isFinite(row[region.id]) ? row[region.id].toFixed(2) : 'No valid data'}</td>)}</tr>)}</tbody></table></div></details>
      </section>

      <section className="regional-results" aria-labelledby="regional-results-title"><div className="chart-title"><div><h3 id="regional-results-title">Where and how much</h3><p>Each place is analyzed on its own. A positive rate means increasing; negative means decreasing.</p></div><Activity size={17} aria-hidden="true" /></div><div className="result-table-wrap"><table className="result-table"><thead><tr><th scope="col">Place</th><th scope="col">Direction and rate</th><th scope="col">Estimated change over period</th><th scope="col">OLS slope interval*</th><th scope="col">Trend evidence</th></tr></thead><tbody>{analysis.data.results.map(({ region, analysis: result, dataRetrievedAt }, index) => <tr key={region.id}><th scope="row"><span className="region-dot" style={{ '--region-color': COLORS[index % COLORS.length] }} aria-hidden="true" />{region.name}<small>{result.nYears} annual values · {result.coverage}% month coverage</small><small>Data retrieved {new Date(dataRetrievedAt).toLocaleDateString()}</small></th><td><span className={`direction ${result.direction}`}>{result.direction === 'decreasing' ? <ArrowDownRight size={15} aria-hidden="true" /> : result.direction === 'increasing' ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}{result.direction}: {result.trendPerYear > 0 ? '+' : ''}{result.trendPerYear} {result.unit}/year</span><small>Robust Sen slope</small></td><td>{result.totalChange > 0 ? '+' : ''}{result.totalChange} {result.unit}{result.percentChange !== null && <small>{result.percentChange > 0 ? '+' : ''}{result.percentChange}% relative to first year</small>}</td><td>{result.confidence95[0]} to {result.confidence95[1]}<small>{result.unit}/year · OLS interval</small></td><td><span className={`significance${result.statisticallySignificant ? ' significant' : ''}`}>{result.statisticallySignificant ? 'Statistical evidence' : 'Inconclusive'}</span><small>Mann–Kendall p={result.pValue} · adjusted q={result.qValue}</small></td></tr>)}</tbody></table></div><p className="table-footnote">* Approximate 95% interval for the OLS slope; it is not an interval for the Sen slope. The trend test does not correct for time correlation. Statistical significance alone does not establish practical importance or causation.</p></section>

      <details className="method-panel"><summary><Info size={15} aria-hidden="true" /> {t('How did TERRA get this result?')}</summary><div className="method-content"><div><h4>{t('Plain-language method')}</h4><p>{t('NASA’s monthly values are combined into day-weighted yearly averages. Years with fewer than 10 valid months are skipped. No missing measurement is filled in.')}</p></div><div><h4>{t('Scientific method and limits')}</h4><p>{analysis.data.method.test} {t('The Sen slope is the median pairwise change per year. The interval is a separate, approximate OLS calculation. The test assumes independent annual values; serial correlation, spatial dependence, measurement uncertainty, and practical significance are not resolved here.')}</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/" target="_blank" rel="noreferrer">{t('NASA POWER monthly data documentation')} ↗</a></div><div><h4>{t('Data source')}</h4><p>{analysis.data.source.name} · {analysis.data.source.product}<br />{t('Model grid point nearest each selected coordinate, not a whole-region average.')}<br />{t('Analysis generated {time}.', { time: new Date(analysis.data.source.analysisGeneratedAt).toLocaleString(locale) })}</p><a href={analysis.data.source.url} target="_blank" rel="noreferrer">{t('Open NASA POWER')} ↗</a></div></div></details>
    </>}
  </main>;
}
