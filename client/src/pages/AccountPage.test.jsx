import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountPage from './AccountPage.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('AccountPage', () => {
  it('submits registration to the server and reports email verification status', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/auth/me') return { ok: true, json: async () => ({ user: null }) };
      return { ok: true, json: async () => ({ message: 'If this address can be registered, a verification email will arrive shortly.' }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/account']}>
          <AccountPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.test' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'a long test password' } });
    fireEvent.click(screen.getByRole('button', { name: /create account and send verification/i }));

    expect(await screen.findByText(/verification email will arrive shortly/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/auth/register')).toBe(true));
    const request = fetchMock.mock.calls.find(([url]) => url === '/api/auth/register');
    expect(JSON.parse(request[1].body)).toEqual({ email: 'person@example.test', password: 'a long test password' });
  });

  it('requires matching passwords before sending a reset request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: null }) }));
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/account?reset=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG']}>
          <AccountPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'first long password' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'another long password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The passwords do not match.');
  });
});
