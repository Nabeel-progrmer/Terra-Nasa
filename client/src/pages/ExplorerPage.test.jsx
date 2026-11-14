import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const viewerInstances = vi.hoisted(() => []);

vi.mock('cesium', () => {
  class Viewer {
    constructor() {
      this.camera = { setView() {}, flyTo() {} };
      this.scene = { canvas: { setAttribute() {} }, globe: {} };
      this.entities = {
        values: [],
        getById() { return null; },
        remove(entity) { this.values = this.values.filter((item) => item !== entity); },
        add(entity) { this.values.push(entity); return entity; },
      };
      this.imageryLayers = { contains() { return false; }, remove() {} };
      viewerInstances.push(this);
    }
    isDestroyed() { return false; }
    destroy() {}
  }
  return {
    Viewer,
    ImageryLayer: class ImageryLayer {},
    OpenStreetMapImageryProvider: class OpenStreetMapImageryProvider {},
    Cartesian3: { fromDegrees: (...coordinates) => coordinates },
    Math: { toRadians: (degrees) => degrees * Math.PI / 180 },
    Color: { fromCssColorString: (value) => value },
    Cartesian2: class Cartesian2 {},
    LabelStyle: { FILL_AND_OUTLINE: 'fill-and-outline' },
    UrlTemplateImageryProvider: class UrlTemplateImageryProvider {},
    WebMercatorTilingScheme: class WebMercatorTilingScheme {},
    Credit: class Credit {},
  };
});

import ExplorerPage from './ExplorerPage.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
  viewerInstances.length = 0;
});

describe('ExplorerPage', () => {
  it('searches and selects a place, loads its weather, and shows real USGS earthquake reports', async () => {
    const fetchMock = vi.fn(async (input) => {
      const path = String(input);
      if (path.startsWith('/api/events')) {
        return { ok: true, json: async () => ({
          source: 'USGS Earthquake Hazards Program',
          count: 1,
          retrievalTime: '2026-01-01T00:05:00Z',
          events: [{
            id: 'us7000test',
            place: 'near Karachi',
            magnitude: 4.2,
            time: '2026-01-01T00:00:00Z',
            coordinates: [67.01, 24.86, 10],
            detailUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000test',
          }],
        }) };
      }
      if (path.startsWith('/api/geocode')) {
        return { ok: true, json: async () => ({
          results: [{ id: '1', name: 'Karachi', region: 'Sindh, Pakistan', latitude: 24.86, longitude: 67.01 }],
        }) };
      }
      if (path.startsWith('/api/weather')) {
        return { ok: true, json: async () => ({
          current: { temperature_2m: 30, apparent_temperature: 32, relative_humidity_2m: 60, wind_speed_10m: 12, precipitation: 0, time: '2026-01-01T00:00' },
          current_units: { temperature_2m: '°C', apparent_temperature: '°C', relative_humidity_2m: '%', wind_speed_10m: 'km/h', precipitation: 'mm' },
          timezone_abbreviation: 'PKT',
          retrievalTime: '2026-01-01T00:05:00Z',
          source: 'Open-Meteo',
        }) };
      }
      if (path.startsWith('/api/earth/ozone')) return { ok: true, json: async () => ({}) };
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><ExplorerPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('link', { name: /M 4.2 near Karachi/i })).toHaveAttribute('href', expect.stringContaining('us7000test'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search for a place' }), { target: { value: 'Karachi' } });
    fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Karachi Sindh, Pakistan/i }));

    expect(await screen.findByText(/Karachi · Coordinates: 24\.8600, 67\.0100/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/weather?latitude=24.86&longitude=67.01'))).toBe(true));
    expect(viewerInstances[0].entities.values.some(({ id }) => id === 'terra-earthquake-us7000test')).toBe(true);
    expect(viewerInstances[0].entities.values.some(({ id }) => id === 'terra-current-location')).toBe(true);
  });
});
