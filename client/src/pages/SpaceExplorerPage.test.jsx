import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SpaceExplorerPage from './SpaceExplorerPage.jsx';

function renderSpaceExplorer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceExplorerPage />
    </QueryClientProvider>,
  );
}

const originalGeolocation = navigator.geolocation;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGeolocation === undefined) delete navigator.geolocation;
  else Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
});

describe('SpaceExplorerPage', () => {
  it('shows model, observed space weather, and NASA close-approach data with provenance', async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path.startsWith('/api/space/atmosphere')) {
        return {
          ok: true,
          json: async () => ({
            source: 'U.S. Standard Atmosphere, 1976',
            selected: { altitudeKm: 0, layer: 'Troposphere', temperatureK: 288.15, temperatureC: 15, pressurePa: 101325, pressureHpa: 1013.25, densityKgPerM3: 1.225 },
            profile: [{ altitudeKm: 0, temperatureC: 15, pressureHpa: 1013.25, densityKgPerM3: 1.225 }],
          }),
        };
      }
      if (path === '/api/space/space-weather') {
        return {
          ok: true,
          json: async () => ({
            source: 'NOAA Space Weather Prediction Center',
            retrievedAt: '2026-11-14T00:00:00.000Z',
            coverage: 'Latest available values.',
            products: {
              planetaryKIndex: [{ time: '2026-11-14T00:00:00', value: 4.67 }],
              dstIndex: [{ time: '2026-11-14T00:00:00', value: -35 }],
              xrayFlux: [{ time: '2026-11-14T00:00:00Z', fluxWm2: 1e-6, satellite: 18 }],
              propagatedSolarWind: [{
                time: '2026-11-14T00:00:00Z',
                propagatedTime: '2026-11-14T00:55:00Z',
                speedKmS: 412,
                densityParticlesCm3: 5.1,
                temperatureK: 100000,
                bzNt: -3.2,
              }],
              recentMessages: [],
            },
            unavailableProducts: [],
          }),
        };
      }
      if (path.startsWith('/api/space/exoplanets')) {
        return {
          ok: true,
          json: async () => ({
            source: 'NASA Exoplanet Archive',
            retrievedAt: '2026-11-14T00:00:00.000Z',
            count: 1,
            search: null,
            limit: 20,
            items: [{
              name: 'TRAPPIST-1 b',
              host: 'TRAPPIST-1',
              discoveryMethod: 'Transit',
              discoveryYear: 2016,
              distanceParsecs: 12.43,
              massJupiter: null,
              radiusJupiter: 0.92,
              orbitalPeriodDays: 1.51,
              hostSpectralType: null,
            }],
            limitations: 'Catalog limitations.',
            queryUrl: 'https://exoplanetarchive.ipac.caltech.edu/',
          }),
        };
      }
      if (path.startsWith('/api/space/planetary-archive')) {
        return {
          ok: true,
          json: async () => ({
            source: 'NASA Planetary Data System Registry',
            retrievedAt: '2026-11-14T00:00:00.000Z',
            product: {
              lid: 'urn:nasa:pds:mars2020_rimfax',
              title: 'Mars 2020 RIMFAX Bundle',
              productType: 'Product_Bundle',
              version: '1.0',
              startDate: '2021-02-18T00:00:00Z',
              stopDate: null,
              updatedAt: '2026-08-11T00:00:00Z',
              labelUrl: 'https://pds.example.nasa.gov/rimfax.xml',
            },
            members: {
              total: 1,
              limit: 25,
              items: [{
                lid: 'urn:nasa:pds:mars2020_rimfax:data_raw',
                title: 'Mars 2020 RIMFAX Raw Data Collection',
                productType: 'Product_Collection',
                version: '16.0',
                startDate: '2021-02-22T20:31:49Z',
                stopDate: null,
                updatedAt: null,
                labelUrl: 'https://pds.example.nasa.gov/data_raw.xml',
              }],
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          source: 'NASA/JPL Near-Earth Object Web Service (NeoWs)',
          retrievedAt: '2026-11-14T00:00:00.000Z',
          window: { startDate: '2026-11-14', endDate: '2026-11-20' },
          count: 1,
          objects: [{
            id: '12345',
            name: 'Test object',
            approachDate: '2026-Nov-14 03:38',
            relativeVelocityKmS: 7.2,
            missDistanceKm: 15974991,
            missDistanceLunar: 41.5,
            estimatedDiameterMinM: 10,
            estimatedDiameterMaxM: 20,
            nasaPotentiallyHazardous: false,
            nasaJplUrl: 'https://ssd.jpl.nasa.gov/',
          }],
          note: 'A close approach is not an impact prediction.',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSpaceExplorer();

    expect(await screen.findByText('NASA/JPL object record')).toBeInTheDocument();
    expect(screen.getByText('NOAA SWPC')).toBeInTheDocument();
    expect(screen.getByText('Test object')).toBeInTheDocument();
    expect(screen.getByText('Mars 2020 RIMFAX Bundle')).toBeInTheDocument();
    expect(screen.getByText('Mars 2020 RIMFAX Raw Data Collection')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solar wind propagated toward Earth' })).toBeInTheDocument();
    expect(screen.getByText('These are NOAA-propagated solar-wind estimates, not direct measurements at Earth. Time labels show upstream sample time; each row also includes NOAA\'s propagated time.')).toBeInTheDocument();
    expect(screen.getAllByText('412').length).toBeGreaterThan(0);
    expect(screen.getByText('A close approach is not an impact prediction.')).toBeInTheDocument();
    expect(screen.getAllByText('4.67').length).toBeGreaterThan(0);
    expect(await screen.findByText('TRAPPIST-1 b')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const lidInput = screen.getByLabelText('NASA PDS product LID');
    fireEvent.change(lidInput, { target: { value: 'urn:nasa:pds:mars2020_rimfax:data_raw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open archive' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/space/planetary-archive?lid=urn%3Anasa%3Apds%3Amars2020_rimfax%3Adata_raw');
    });

    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/space/atmosphere?altitudeKm=12');
    });
  });

  it('only requests device location after opt-in and calculates the geometric sky locally', async () => {
    const getCurrentPosition = vi.fn((success) => success({
      coords: { latitude: 24.86, longitude: 67.01 },
    }));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const fetchMock = vi.fn(async (path) => {
      if (path.startsWith('/api/space/ephemeris?')) {
        return {
          ok: true,
          json: async () => ({
            source: 'Astronomy Engine, calculated locally',
            computedAt: '2026-11-14T00:00:00.000Z',
            requestedTimeUtc: '2026-11-14T00:00:00.000Z',
            limitations: 'Approximate calculations; clouds and other observing conditions are not modeled.',
            sky: { geometricSunAltitudeDegrees: -20, sunBelowAstronomicalTwilight: true },
            bodies: [{
              name: 'Mars',
              rightAscensionHours: 2,
              declinationDegrees: 3,
              azimuthDegrees: 130,
              geometricAltitudeDegrees: 25,
              distanceAu: 1.5,
              visualMagnitude: 1,
              illuminatedFraction: 0.5,
              aboveGeometricHorizon: true,
              riseWithin24HoursUtc: '2026-11-14T03:00:00.000Z',
              setWithin24HoursUtc: '2026-11-14T15:00:00.000Z',
            }],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          source: 'Test source',
          retrievedAt: '2026-11-14T00:00:00.000Z',
          coverage: 'Test.',
          products: { planetaryKIndex: [], dstIndex: [], xrayFlux: [], propagatedSolarWind: [], recentMessages: [] },
          unavailableProducts: [],
          window: { startDate: '2026-11-14', endDate: '2026-11-20' },
          count: 0,
          objects: [],
          note: 'Test.',
          profile: [],
          selected: {},
          product: { productType: 'Product_Bundle' },
          members: { items: [], total: 0, limit: 25, nextCursor: null },
          items: [],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSpaceExplorer();

    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(await screen.findByText(/coordinates filled from your device/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /calculate sky/i }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => path.startsWith('/api/space/ephemeris?latitude=24.86&longitude=67.01&time='))).toBe(true));
    expect(await screen.findByRole('table', { name: /calculated solar-system positions/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /25.*above/i })).toBeInTheDocument();
    expect(screen.getByText(/clouds, haze, light pollution/i)).toBeInTheDocument();
  });
});
