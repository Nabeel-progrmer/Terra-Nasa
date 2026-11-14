import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LearningCenterPage from './LearningCenterPage.jsx';
import articlesData from '../../../shared/learning-articles.json';
import articleTranslations from '../../../shared/learning-article-translations.json';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderLearningCenter(fetchMock, path = '/learn/trend-analysis') {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/learn/:articleId" element={<LearningCenterPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LearningCenterPage', () => {
  it('has Urdu title, summary, section, list, and link text for every documentation article', () => {
    const translations = articleTranslations['ur-PK'];
    expect(Object.keys(translations)).toHaveLength(articlesData.articles.length);
    for (const article of articlesData.articles) {
      const localized = translations[article.id];
      expect(localized?.title, article.id).toBeTruthy();
      expect(localized?.summary, article.id).toBeTruthy();
      expect(localized?.sections, article.id).toHaveLength(article.sections.length);
      localized.sections.forEach((section, index) => {
        expect(section.heading, `${article.id}:${index}`).toBeTruthy();
        if (article.sections[index].text) expect(section.text, `${article.id}:${index}`).toBeTruthy();
        if (article.sections[index].items) expect(section.items, `${article.id}:${index}`).toHaveLength(article.sections[index].items.length);
        if (article.sections[index].link) expect(section.linkLabel, `${article.id}:${index}`).toBeTruthy();
      });
    }
  });

  it('offers only English and Urdu and keeps article search available', async () => {
    renderLearningCenter(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ config: { assistant: { configured: false } } }),
    }));

    expect(await screen.findByRole('heading', { name: 'Earth Trend Detector' })).toBeInTheDocument();
    expect(Array.from(screen.getByRole('combobox', { name: /choose language or locale/i }).options).map(({ value }) => value))
      .toEqual(['en-US', 'ur-PK']);
    expect(screen.getByText(/each represents the nearest NASA POWER grid point/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: /search help articles/i }), { target: { value: 'Mann-Kendall' } });
    expect(screen.getByRole('link', { name: 'Earth Trend Detector' })).toBeInTheDocument();
    const locales = Array.from(screen.getByRole('combobox', { name: /choose language or locale/i }).options).map(({ value }) => value);
    expect(locales).not.toContain('ar');
    expect(locales).not.toContain('ja-JP');
  });

  it('offers no other selectable languages', async () => {
    renderLearningCenter(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ config: { assistant: { configured: false } } }),
    }));
    const localePicker = await screen.findByRole('combobox', { name: /choose language or locale/i });
    expect(Array.from(localePicker.options).map(({ value }) => value)).toEqual(['en-US', 'ur-PK']);
  });

  it('shows Urdu across the documentation articles and reports translation coverage', async () => {
    renderLearningCenter(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ config: { assistant: { configured: false } } }),
    }), '/learn/getting-started');

    fireEvent.change(await screen.findByRole('combobox', { name: /choose language or locale/i }), { target: { value: 'ur-PK' } });

    expect(await screen.findByRole('heading', { name: 'ٹیرا کے ساتھ شروعات' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ٹیرا کیا کرتا ہے' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'ٹیرا کے ساتھ شروعات' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/19 از 19 دستاویزی مضامین اردو میں دستیاب ہیں/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /اگلا/i }));
    expect(await screen.findByRole('heading', { name: 'TERRA کا تعارف' })).toBeInTheDocument();
  });

  it('sends the current article and section to the existing Guide API', async () => {
    const fetchMock = vi.fn(async (_url, options) => {
      if (!options) return { ok: true, json: async () => ({ config: { assistant: { configured: true } } }) };
      return { ok: true, json: async () => ({ answer: 'The Sen slope estimates change per year.', source: '/learn/trend-analysis' }) };
    });
    renderLearningCenter(fetchMock);

    await screen.findByText(/article-aware AI guide/i);
    fireEvent.change(screen.getByRole('textbox', { name: /ask about earth trend detector/i }), { target: { value: 'Explain the slope.' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/Sen slope estimates change per year/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/guide/ask')).toBe(true));
    const request = JSON.parse(fetchMock.mock.calls.find(([url]) => url === '/api/guide/ask')[1].body);
    expect(request).toMatchObject({
      question: 'Explain the slope.',
      language: 'en',
      context: { type: 'documentation', articleId: 'trend-analysis', sectionHeading: 'Choose a variable' },
      history: [],
    });
  });
});
