import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GuidePage from './GuidePage.jsx';

afterEach(() => vi.unstubAllGlobals());

describe('GuidePage live context', () => {
  it('uses Urdu for the answer language and reviewed preset explanations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ config: { assistant: { configured: false } } }) }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <GuidePage locale="ur-PK" />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const language = await screen.findByRole('combobox', { name: 'جواب کی زبان' });
    expect(language).toHaveValue('ur-PK');
    fireEvent.click(screen.getByRole('button', { name: /اعداد و شمار میں/ }));
    expect(await screen.findByText(/کا مطلب ہے کہ کوئی رجحان/)).toBeInTheDocument();
  });

  it('keeps the Guide answer language in sync when the app locale changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ config: { assistant: { configured: false } } }) }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(<MemoryRouter><QueryClientProvider client={queryClient}><GuidePage locale="en-US" /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Understand the Earth data' });
    rerender(<MemoryRouter><QueryClientProvider client={queryClient}><GuidePage locale="ur-PK" /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByRole('combobox', { name: 'جواب کی زبان' })).toHaveValue('ur-PK');
  });

  it('sends location weather only after selection and shows returned source provenance', async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/config-status') {
        return {
          ok: true,
          json: async () => ({ config: { assistant: { configured: true } } }),
        };
      }
      if (path === '/api/guide/ask') {
        return {
          ok: true,
          json: async () => ({
            answer: 'The current Open-Meteo values show warm, humid model conditions.',
            context: {
              type: 'Weather model output',
              retrievedAt: '2026-03-20T00:05:00.000Z',
              sources: [{
                name: 'Open-Meteo Forecast API',
                url: 'https://api.open-meteo.com/v1/forecast?latitude=24.86&longitude=67.01',
                validTime: '2026-03-20T00:00',
              }],
            },
          }),
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <GuidePage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText(/Groq-powered guide is connected/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Optional live data context' }), { target: { value: 'weather' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '24.86' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '67.01' } });
    fireEvent.change(screen.getByLabelText(/Your question/), { target: { value: 'Explain this weather.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText(/warm, humid model conditions/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const requestBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(requestBody.context).toEqual({ type: 'weather', latitude: 24.86, longitude: 67.01 });
    expect(screen.getByRole('link', { name: /Open-Meteo Forecast API/i })).toHaveAttribute(
      'href',
      'https://api.open-meteo.com/v1/forecast?latitude=24.86&longitude=67.01',
    );
    expect(screen.getByText(/valid 2026-03-20T00:00/i)).toBeInTheDocument();
  });
});
