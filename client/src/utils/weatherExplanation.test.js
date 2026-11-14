import { describe, expect, it } from 'vitest';
import { buildWeatherExplanation, getNextForecastHours, getWeatherDescription } from './weatherExplanation.js';

describe('weather interpretation helpers', () => {
  it('uses the WMO condition code table and does not invent an unknown condition', () => {
    expect(getWeatherDescription(3)).toBe('Overcast');
    expect(getWeatherDescription(999)).toBeNull();
    expect(getWeatherDescription(null)).toBeNull();
  });

  it('calculates explanations only from provider fields that exist', () => {
    const explanations = buildWeatherExplanation({
      weather_code: 2,
      temperature_2m: 30,
      apparent_temperature: 35,
      relative_humidity_2m: 70,
      dew_point_2m: 23,
      cloud_cover: 50,
      shortwave_radiation: 400,
      wind_speed_10m: 10,
      surface_pressure: 1002,
    });

    expect(explanations.find(({ label }) => label === 'Provider condition code').text).toContain('Partly cloudy (WMO code 2)');
    expect(explanations.find(({ label }) => label === 'Air temperature and comfort').text).toContain('5.0° warmer');
    expect(explanations.find(({ label }) => label === 'Moisture in the air').text).toContain('7.0 °C (30.0 − 23.0)');
    expect(explanations.find(({ label }) => label === 'Clouds and sunlight').text).toContain('400 W/m²');
    expect(explanations.find(({ label }) => label === 'Surface pressure').text).toContain('not enough to diagnose');

    expect(buildWeatherExplanation({ temperature_2m: null, weather_code: null })).toEqual([]);
  });

  it('provides Arabic condition and scientific interpretation labels and text', () => {
    expect(getWeatherDescription(3, 'ar')).toBe('غائم كلياً');
    const explanations = buildWeatherExplanation({
      weather_code: 2,
      temperature_2m: 30,
      apparent_temperature: 35,
      relative_humidity_2m: 70,
      dew_point_2m: 23,
      cloud_cover: 50,
      wind_speed_10m: 10,
      surface_pressure: 1002,
    }, {}, 'ar');
    expect(explanations.map(({ label }) => label)).toContain('درجة حرارة الهواء والإحساس الحراري');
    expect(explanations.every(({ text }) => !text.includes('provider’s'))).toBe(true);
    expect(explanations.every(({ label }) => /[\u0600-\u06FF]/.test(label))).toBe(true);
  });

  it('provides Urdu weather conditions and evidence-based explanations', () => {
    expect(getWeatherDescription(3, 'ur-PK')).toBe('مکمل ابر آلود');
    const explanations = buildWeatherExplanation({
      weather_code: 2,
      temperature_2m: 30,
      apparent_temperature: 35,
      relative_humidity_2m: 70,
      dew_point_2m: 23,
      cloud_cover: 50,
      wind_speed_10m: 10,
      surface_pressure: 1002,
    }, {}, 'ur-PK');
    expect(explanations.map(({ label }) => label)).toContain('ہوا کا درجۂ حرارت اور محسوس ہونے والی کیفیت');
    expect(explanations.every(({ text }) => !text.includes('provider’s'))).toBe(true);
    expect(explanations.every(({ label }) => /[\u0600-\u06FF]/.test(label))).toBe(true);
  });

  it('aligns the hourly graph to provider current time and leaves missing values blank', () => {
    const rows = getNextForecastHours({
      current: { time: '2026-11-14T09:00' },
      hourly: {
        time: ['2026-11-14T08:00', '2026-11-14T09:00', '2026-11-14T10:00'],
        temperature_2m: [17, null, 19],
        wind_speed_10m: [4, '', 6],
        precipitation_probability: [0, 20, null],
        precipitation: [0, 0.1, null],
      },
    });

    expect(rows).toEqual([
      { time: '2026-11-14T09:00', label: '09:00', temperature: null, wind: null, precipitationProbability: 20, precipitation: 0.1 },
      { time: '2026-11-14T10:00', label: '10:00', temperature: 19, wind: 6, precipitationProbability: null, precipitation: null },
    ]);
  });
});
