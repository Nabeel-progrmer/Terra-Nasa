import { apiFetch } from './http.js';

export async function fetchWeather({ latitude, longitude }) {
  const response = await apiFetch(`/api/weather?latitude=${latitude}&longitude=${longitude}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Weather data unavailable');
  return data;
}
