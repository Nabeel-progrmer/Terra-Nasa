import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';

const QUESTION_STARTERS = [
  'How is near-surface air temperature changing across these places?',
  'How is precipitation changing across these places?',
  'Are humidity trends different across these places?',
  'Are wind-speed trends different across these places?',
];

async function fetchInvestigations({ page }) {
  const response = await apiFetch(`/api/investigations?page=${page}&limit=20`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Investigation workspace unavailable');
  return data;
}

async function fetchAccount() {
  const response = await apiFetch('/api/auth/me');
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Account status unavailable.');
  return data;
}

async function saveInvestigation(payload) {
  const response = await apiFetch('/api/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not save this research note');
  return data;
}

export default function InvestigationsPage({ locale = 'en-US' }) {
  const t = (source, values) => translate(locale, source, values);
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [region, setRegion] = useState('Global');
  const [dataset, setDataset] = useState('NASA POWER');
  const [page, setPage] = useState(1);
  const [customQuestion, setCustomQuestion] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const account = useQuery({ queryKey: ['account-session'], queryFn: fetchAccount, retry: false });
  const signedIn = Boolean(account.data?.user);
  const investigations = useQuery({ queryKey: ['investigations', account.data?.user?.id, page], queryFn: () => fetchInvestigations({ page }), enabled: signedIn, retry: 1 });
  const mutation = useMutation({ mutationFn: saveInvestigation, onSuccess: async () => { setStatusMessage(t('Research note saved.')); setQuestion(''); setCustomQuestion(''); await queryClient.invalidateQueries({ queryKey: ['investigations'] }); } });
  const finalQuestion = question === 'custom' ? customQuestion : question;

  const submit = (event) => {
    event.preventDefault();
    if (!finalQuestion.trim()) return;
    const title = `${dataset} research note`;
    mutation.mutate({ title, question: finalQuestion.trim(), region, datasets: [dataset], methods: [], conclusion: '' });
  };

  return <main className="page investigations-page">
    <header className="page-header"><p className="eyebrow">{t('Scientific workspace')}</p><h1>{t('Research notes')}</h1><p>{t('Save questions and conclusions in a private workspace linked to your verified TERRA account.')}</p></header>

    <section className="investigation-compose" aria-labelledby="compose-title"><div className="investigation-compose-heading"><span className="compose-icon"><BookOpen size={18} aria-hidden="true" /></span><div><h2 id="compose-title">{t('Start a research note')}</h2><p>{t('Choose a question starter; you do not have to type one.')}</p></div></div>
      <p id="private-note-info">{t('Only your verified account can read the notes you save here.')}</p>
      {!signedIn && <p role={account.error ? 'alert' : 'status'}>{account.error ? t('Account status unavailable.') : t('Sign in to create and view private research notes.')} <Link to="/account">{t('Open account sign-in')}</Link></p>}
      <form onSubmit={submit} aria-describedby="private-note-info">
        <label htmlFor="investigation-question">{t('Research question')}</label>
        <select id="investigation-question" value={question} onChange={(event) => { setQuestion(event.target.value); setStatusMessage(''); }} required><option value="">{t('Choose a question starter')}</option>{QUESTION_STARTERS.map((starter) => <option key={starter} value={starter}>{t(starter)}</option>)}<option value="custom">{t('Write a different question...')}</option></select>
        {question === 'custom' && <label htmlFor="custom-investigation-question">{t('Your question')}<textarea id="custom-investigation-question" required minLength={10} maxLength={500} value={customQuestion} onChange={(event) => { setCustomQuestion(event.target.value); setStatusMessage(''); }} placeholder={t('What would you like to understand?')} /></label>}
        <label htmlFor="investigation-region">{t('Area of interest')}<select id="investigation-region" value={region} onChange={(event) => { setRegion(event.target.value); setStatusMessage(''); }}><option value="Global">{t('Global')}</option><option>New York</option><option>Central Amazon</option><option>Sahel</option><option>Greenland</option><option>Tokyo</option><option>Sydney</option></select></label>
        <label htmlFor="investigation-dataset">{t('Data source to explore')}<select id="investigation-dataset" value={dataset} onChange={(event) => { setDataset(event.target.value); setStatusMessage(''); }}><option>NASA POWER</option><option>Open-Meteo</option><option>USGS Earthquakes</option></select></label>
        <button type="submit" className="primary save-note-button" disabled={!signedIn || mutation.isPending || finalQuestion.trim().length < 10}><Plus size={16} aria-hidden="true" />{mutation.isPending ? t('Saving note...') : t('Save research note')}</button>
      </form>
      {statusMessage && <p role="status" aria-live="polite" className="save-note-status">{statusMessage}</p>}
      {mutation.isError && <p role="alert" className="error">{t('Could not save this note. Please try again.')}</p>}
      {investigations.error && <p className="investigation-storage-message" role="alert">{t('Saved notes are unavailable right now.')}</p>}
    </section>

    <section className="saved-notes" aria-labelledby="saved-notes-title"><div className="section-heading"><div><p className="eyebrow small-eyebrow">{t('PRIVATE WORKSPACE')}</p><h2 id="saved-notes-title">{t('Saved research notes')}</h2></div>{investigations.isFetching && <RefreshCw size={16} className="spin" aria-label={t('Refreshing notes')} />}</div>
      {signedIn && investigations.isLoading && <p role="status">{t('Loading saved notes...')}</p>}
      {!signedIn && !account.error && <p role="status">{t('Sign in to load private notes.')} <Link to="/account">{t('Open account sign-in')}</Link></p>}
      {investigations.data && investigations.data.items.length === 0 && <div className="status-panel"><p>{t('No notes have been saved yet.')}</p></div>}
      {investigations.data?.items?.length > 0 && <><div className="investigation-list">{investigations.data.items.map((item) => <article key={item.id} className="investigation-card"><h3>{item.title}</h3><p><strong>{t('Question:')}</strong> {item.question}</p><p><strong>{t('Region:')}</strong> {item.region}</p><p><strong>{t('Datasets:')}</strong> {item.datasets.join(', ') || t('Not selected')}</p><p><strong>{t('Methods:')}</strong> {item.methods.join(', ') || t('Not recorded')}</p>{item.conclusion && <p><strong>{t('Conclusion:')}</strong> {item.conclusion}</p>}<small>{t('Created')} {new Date(item.createdAt).toLocaleString(locale)}</small></article>)}</div>{investigations.data.pages > 1 && <nav className="investigation-pagination" aria-label={t('Research note pages')}><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('Previous page')}</button><span>{t('Page {page} of {pages}', { page, pages: investigations.data.pages })}</span><button type="button" disabled={page >= investigations.data.pages} onClick={() => setPage((value) => value + 1)}>{t('Next page')}</button></nav>}</>}
    </section>
  </main>;
}


