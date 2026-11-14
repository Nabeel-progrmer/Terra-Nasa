import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InvestigationsPage from './InvestigationsPage.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('InvestigationsPage', () => {
  it('renders translated private notes and a working account link when signed out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: null }) }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/investigations']}>
          <InvestigationsPage locale="ar" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'ملاحظات البحث' })).toBeInTheDocument();
    expect(screen.getByText('لا يمكن قراءة الملاحظات المحفوظة هنا إلا من خلال حسابك الموثّق.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'افتح تسجيل الدخول إلى الحساب' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'افتح تسجيل الدخول إلى الحساب' })[0]).toHaveAttribute('href', '/account');
    expect(screen.getByRole('button', { name: /احفظ ملاحظة البحث/i })).toBeDisabled();
  });
});
