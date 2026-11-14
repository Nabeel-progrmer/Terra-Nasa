import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WeatherPage from './WeatherPage.jsx';

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

function renderWeatherPage(initialEntries = ['/weather']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <WeatherPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation);
  else delete navigator.geolocation;
});

describe('WeatherPage current location', () => {
  it('only requests location after opt-in and loads weather for the returned coordinates', async () => {
    const getCurrentPosition = vi.fn((success) => success({
      coords: { latitude: 24.8615, longitude: 67.0099 },
    }));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'Open-Meteo',
        retrievalTime: '2025-01-01T12:00:00.000Z',
        dataType: 'Open-Meteo forecast-model output; not a direct local station observation',
        timezone_abbreviation: 'PKT',
        current: { time: '2025-01-01T12:00', temperature_2m: 28, apparent_temperature: 30, relative_humidity_2m: 60, dew_point_2m: 19, wind_speed_10m: 8, precipitation: 0, weather_code: 2 },
        current_units: { temperature_2m: '°C', apparent_temperature: '°C', relative_humidity_2m: '%', dew_point_2m: '°C', wind_speed_10m: 'km/h', precipitation: 'mm' },
        hourly: {
          time: ['2025-01-01T12:00', '2025-01-01T13:00'],
          temperature_2m: [28, 29],
          precipitation_probability: [10, 20],
          precipitation: [0, 0],
          wind_speed_10m: [8, 9],
        },
        hourly_units: { temperature_2m: '°C', precipitation_probability: '%', precipitation: 'mm', wind_speed_10m: 'km/h' },
        daily: { time: [] },
        daily_units: {},
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWeatherPage();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));

    expect(await screen.findByText(/MODEL CONDITIONS · Your current location/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/weather?latitude=24.8615&longitude=67.0099');
    });
    expect(screen.getByText(/Coordinates: 24\.8615, 67\.0099/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /why might the weather feel this way/i })).toBeInTheDocument();
    expect(screen.getByText(/Air temperature minus dew point is 9\.0 °C/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /24 provider hourly model values for temperature and wind/i })).toBeInTheDocument();
  });

  it('explains denied location permission and keeps the city choices available', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) => error({ code: 1 }),
      },
    });

    renderWeatherPage();
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/location access was denied/i);
    expect(screen.getByRole('button', { name: /London, United Kingdom/i })).toBeEnabled();
  });

  it('uses a selected map location when opening the detailed weather page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'Open-Meteo',
        retrievalTime: '2026-11-14T00:00:00.000Z',
        current: { temperature_2m: 22 },
        current_units: { temperature_2m: '°C' },
        daily: { time: [] },
        daily_units: {},
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWeatherPage([{
      pathname: '/weather',
      state: { weatherLocation: { name: 'Your current location', latitude: 35.68, longitude: 139.69 } },
    }]);

    expect(await screen.findByText(/MODEL CONDITIONS · Your current location/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/weather?latitude=35.68&longitude=139.69');
  });
});
