import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrendPage from './TrendPage.jsx';

afterEach(() => vi.unstubAllGlobals());

describe('TrendPage', () => {
  const regions = [
    { id: 'nyc', name: 'New York', latitude: 40.71, longitude: -74.01 },
    { id: 'amazon', name: 'Central Amazon', latitude: -3.47, longitude: -62.22 },
    { id: 'sahel', name: 'Sahel · Niamey', latitude: 13.51, longitude: 2.11 },
    { id: 'greenland', name: 'Greenland · Summit', latitude: 72.58, longitude: -38.46 },
    { id: 'tokyo', name: 'Tokyo', latitude: 35.68, longitude: 139.69 },
    { id: 'sydney', name: 'Sydney', latitude: -33.87, longitude: 151.21 },
  ];

  const analysisResult = {
    variable: { id: 'T2M', label: 'Near-surface air temperature', unit: '°C' },
    period: { requestedStart: 2016, requestedEnd: 2025 },
    source: { product: 'MERRA-2 meteorological reanalysis', name: 'NASA POWER', url: 'https://power.larc.nasa.gov/', analysisGeneratedAt: '2026-01-01T00:00:00Z' },
    method: { test: 'Mann–Kendall test' },
    results: [{
      region: { id: 'nyc', name: 'New York', latitude: 40.71, longitude: -74.01 },
      dataRetrievedAt: '2026-01-01T00:00:00Z',
      analysis: {
        observations: [{ year: 2016, value: 10, validMonths: 12 }, { year: 2025, value: 11, validMonths: 12 }],
        nYears: 10, coverage: 100, direction: 'increasing', trendPerYear: 0.1,
        totalChange: 0.9, percentChange: null, confidence95: [0.01, 0.2],
        statisticallySignificant: true, pValue: 0.01, qValue: 0.01, unit: '°C',
      },
    }],
    failures: [],
  };

  const catalogResult = {
    variables: [{ id: 'T2M', label: 'Near-surface air temperature', unit: '°C', aggregation: 'day-weighted annual mean', startYear: 1981 }],
    regions,
  };

  it('runs a trend analysis for one selected location', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/variables') {
        return {
          ok: true,
          json: async () => ({
            ...catalogResult,
          }),
        };
      }
      if (url.pathname === '/api/change-analysis') {
        return {
          ok: true,
          json: async () => analysisResult,
        };
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><TrendPage /></QueryClientProvider>);

    const regionBoxes = await screen.findAllByRole('checkbox');
    for (const box of regionBoxes.filter((item) => item.checked).slice(1)) fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: /Compare these places/i }));

    await waitFor(() => {
      const analysisUrl = fetchMock.mock.calls
        .map(([input]) => new URL(String(input), 'http://localhost'))
        .find((url) => url.pathname === '/api/change-analysis');
      expect(JSON.parse(analysisUrl?.searchParams.get('locations') || '[]')).toMatchObject([
        { type: 'point', id: 'nyc', name: 'New York' },
      ]);
    });
    expect(await screen.findByText(/New York/)).toBeInTheDocument();
    expect(await screen.findByText('Statistical evidence')).toBeInTheDocument();
  });

  it('adds custom points and a bounded area to the same analysis', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/variables') return { ok: true, json: async () => catalogResult };
      if (url.pathname === '/api/change-analysis') return { ok: true, json: async () => analysisResult };
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><TrendPage /></QueryClientProvider>);

    fireEvent.change(await screen.findByLabelText('Point name'), { target: { value: 'Karachi' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '24.86' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '67.01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add point' }));

    fireEvent.change(screen.getByLabelText('Area name'), { target: { value: 'Sindh sample box' } });
    fireEvent.change(screen.getByLabelText('South latitude'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('North latitude'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('West longitude'), { target: { value: '66' } });
    fireEvent.change(screen.getByLabelText('East longitude'), { target: { value: '67' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
    fireEvent.click(screen.getByRole('button', { name: /Compare these places/i }));

    await waitFor(() => {
      const analysisUrl = fetchMock.mock.calls
        .map(([input]) => new URL(String(input), 'http://localhost'))
        .find((url) => url.pathname === '/api/change-analysis');
      const locations = JSON.parse(analysisUrl?.searchParams.get('locations') || '[]');
      expect(locations).toHaveLength(6);
      expect(locations).toContainEqual(expect.objectContaining({ type: 'point', name: 'Karachi', latitude: 24.86, longitude: 67.01 }));
      expect(locations).toContainEqual(expect.objectContaining({ type: 'area', name: 'Sindh sample box', minLatitude: 24, maxLatitude: 25, minLongitude: 66, maxLongitude: 67 }));
    });
  });
});
