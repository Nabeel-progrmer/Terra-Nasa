import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SourcesPage from './SourcesPage.jsx';

function renderSourcesPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SourcesPage />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('SourcesPage', () => {
  it('shows provenance, documentation links, and filterable data types', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 2,
        note: 'Integration status does not verify provider uptime.',
        items: [
          {
            id: 'open-meteo',
            name: 'Open-Meteo Forecast API',
            category: 'Atmosphere',
            provider: 'Open-Meteo',
            endpoint: 'https://open-meteo.com/en/docs',
            auth: 'No key used by TERRA',
            dataType: 'Forecast/model output',
            coverage: 'Global model coverage',
            updateFrequency: 'Hourly',
            adapter: 'Weather endpoint',
            provenance: 'Provider coordinates and retrieval time are returned.',
            isActive: true,
            tags: ['weather'],
          },
          {
            id: 'nasa-pds-registry',
            name: 'NASA Planetary Data System Registry',
            category: 'Planetary science',
            provider: 'NASA PDS',
            endpoint: 'https://pds.mcp.nasa.gov/api/search/1/',
            auth: 'Public API',
            dataType: 'Archive catalog metadata',
            coverage: 'Product bundles and collections',
            updateFrequency: 'Provider updates',
            adapter: 'Planetary archive browser',
            provenance: 'Catalog labels are not decoded science measurements.',
            isActive: true,
            tags: ['PDS'],
          },
        ],
      }),
    }));

    renderSourcesPage();

    expect(await screen.findByText('NASA Planetary Data System Registry')).toBeInTheDocument();
    expect(screen.getByText('Integration status does not verify provider uptime.')).toBeInTheDocument();
    expect(screen.getByText('Catalog labels are not decoded science measurements.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Provider documentation' })).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Search sources'), { target: { value: 'archive catalog' } });
    expect(screen.getByText('NASA Planetary Data System Registry')).toBeInTheDocument();
    expect(screen.queryByText('Open-Meteo Forecast API')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search sources'), { target: { value: 'not a source' } });
    expect(screen.getByRole('status')).toHaveTextContent('No integrated sources match these filters.');
  });
});
