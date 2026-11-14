import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  function renderApp() {
    const queryClient = new QueryClient();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy', readiness: 'degraded', events: [], count: 0 }),
    }));

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it('renders the landing page heading', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: /see how earth is changing/i })).toBeInTheDocument();
  });

  it('navigates into the integrated Learning Center', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('link', { name: 'Learning center' }));

    expect(await screen.findByRole('heading', { name: 'TERRA Learning Center' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Getting started with TERRA' })).toBeInTheDocument();
  });

  it('shows device-specific install help when the browser has no install prompt', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /install terra on this device/i }));

    expect(await screen.findByRole('heading', { name: /install from your browser/i })).toBeInTheDocument();
    expect(screen.getByText(/secure https connection/i)).toBeInTheDocument();
  });

  it('marks retained observations stale offline and reports reconnection', async () => {
    renderApp();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));
    expect(await screen.findByText(/live Earth and space data cannot refresh/i)).toBeInTheDocument();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    expect(await screen.findByText(/Online — reconnecting may refresh live observations/i)).toBeInTheDocument();
  });

  it('offers a user-controlled service worker update when one is ready', async () => {
    renderApp();
    fireEvent(window, new Event('terra:sw-update-ready'));
    expect(await screen.findByRole('button', { name: 'Update now' })).toBeInTheDocument();
  });

  it('applies accessibility display preferences to the document', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /language and accessibility settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /high contrast/i }));

    expect(document.documentElement.dataset.highContrast).toBe('true');
  });

  it('applies a bundled Urdu interface locale across the site navigation', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /language and accessibility settings/i }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ur-PK' } });

    expect(await screen.findByRole('link', { name: 'جائزہ' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'ur-PK');
    expect(screen.getByText(/اردو انٹرفیس فعال ہے/)).toBeInTheDocument();
  });

  it('offers exactly English and Urdu', async () => {
    localStorage.removeItem('terra-learning-locale');
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /language and accessibility settings/i }));
    const languagePicker = screen.getByRole('combobox', { name: 'Language' });
    expect([...languagePicker.options].map((option) => option.value)).toEqual(['en-US', 'ur-PK']);
  });
});
