import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

const fetchSources = async () => {
  const response = await apiFetch('/api/data-sources');
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Data source registry unavailable');
  return data;
};

export default function SourcesPage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
  });
  const categories = useMemo(
    () => [...new Set((data?.items || []).map((item) => item.category))].sort(),
    [data?.items],
  );
  const filteredItems = (data?.items || []).filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const query = search.trim().toLocaleLowerCase();
    const searchable = [item.name, item.category, item.provider, item.dataType, item.adapter, ...(item.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    return matchesCategory && (!query || searchable.includes(query));
  });

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">{t('Data source registry')}</p>
        <h1>{t('Data adapters & provenance')}</h1>
        <p>{t('Inspect each integration\'s data type, coverage, update cadence, and limitations. “Integrated” means a TERRA adapter exists; it does not mean the provider is currently online.')}</p>
      </header>

      {isLoading ? <p>{t('Loading registry...')}</p> : null}
      {error ? <div className="sources-error" role="alert"><p>{t('Source registry is temporarily unavailable.')}</p><button className="secondary" type="button" onClick={() => refetch()} disabled={isFetching}>{isFetching ? t('Retrying…') : t('Retry registry')}</button></div> : null}

      {data ? (
        <>
          <div className="source-registry-toolbar">
            <p className="source-registry-note">{t(data.note)} <span>{t('{shown} of {total} integrations', { shown: filteredItems.length, total: data.count })}</span></p>
            <div className="source-registry-filters">
              <label htmlFor="source-search">{t('Search sources')}</label>
              <input id="source-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Provider, data type, or topic')} />
              <label htmlFor="source-category">{t('Category')}</label>
              <select id="source-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">{t('All categories')}</option>
                {categories.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}
              </select>
            </div>
          </div>
          <div className="source-grid">
            {filteredItems.map((item) => (
              <article key={item.id} className="source-card">
                <div className="card-header">
                  <h2>{item.name}</h2>
                  <span className={`status-pill ${item.isActive ? 'active' : 'inactive'}`}>
                    {item.isActive ? t('Integrated') : t('Not integrated')}
                  </span>
                </div>
                <p><strong>{t('Category:')}</strong> {item.category}</p>
                <p><strong>{t('Provider:')}</strong> {item.provider}</p>
                <p><strong>{t('Auth:')}</strong> {item.auth}</p>
                <p><strong>{t('Data type:')}</strong> {item.dataType}</p>
                <p><strong>{t('Coverage:')}</strong> {item.coverage}</p>
                <p><strong>{t('Update:')}</strong> {item.updateFrequency}</p>
                <p><strong>{t('TERRA adapter:')}</strong> {item.adapter}</p>
                <p className="source-provenance">{item.provenance}</p>
                {item.endpoint && <a className="source-endpoint" href={item.endpoint} target="_blank" rel="noreferrer">{t('Provider documentation')} <span aria-hidden="true">↗</span></a>}
                {item.tags?.length > 0 && <ul className="source-tags" aria-label={t('Source topics')}>{item.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
              </article>
            ))}
          </div>
          {filteredItems.length === 0 && <p className="source-empty" role="status">{t('No integrated sources match these filters. Try another topic or category.')}</p>}
        </>
      ) : null}
    </main>
  );
}
