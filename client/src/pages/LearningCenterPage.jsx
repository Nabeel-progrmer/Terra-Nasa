import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bookmark, Bot, Check, ChevronDown, Copy, Languages, Menu, MessageCircle, PanelRightClose, PanelRightOpen, Search, Send, Sparkles, StopCircle, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import articlesData from '../../../shared/learning-articles.json';
import articleTranslations from '../../../shared/learning-article-translations.json';
import { getLocale, readSavedLocale, selectableLocales, translate } from '../i18n.js';
import { apiFetch } from '../api/http.js';

const articles = articlesData.articles;
const COMPLETED_KEY = 'terra-learning-completed';
const BOOKMARKS_KEY = 'terra-learning-bookmarks';
const RECENT_KEY = 'terra-learning-recent';
const LOCALE_KEY = 'terra-learning-locale';

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getLocalizedArticle(article, locale) {
  const translation = articleTranslations[locale]?.[article.id];
  if (!translation) return { ...article, category: translate(locale, article.category) };
  return {
    ...article,
    ...translation,
    category: translation.category || translate(locale, article.category),
    sections: article.sections.map((section, index) => {
      const localized = translation.sections?.[index];
      if (!localized) return section;
      return {
        ...section,
        ...localized,
        link: section.link && localized.linkLabel ? { ...section.link, label: localized.linkLabel } : section.link,
      };
    }),
  };
}

function articleSearchText(article, locale) {
  const localized = getLocalizedArticle(article, locale);
  return [
    article.title,
    article.summary,
    article.category,
    localized.title,
    localized.summary,
    localized.category,
    ...article.tags,
    ...localized.sections.flatMap((section) => [section.heading, section.text, ...(section.items || [])]),
  ].join(' ').toLocaleLowerCase();
}

function headingId(value) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function markdownText(article) {
  return article.sections.map((section) => `${section.heading}\n${section.text || ''}\n${(section.items || []).join('\n')}`).join('\n\n');
}

export default function LearningCenterPage({ locale: controlledLocale, onLocaleChange }) {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const article = articles.find((item) => item.id === articleId) || articles[0];
  const articleIndex = articles.indexOf(article);
  const [query, setQuery] = useState('');
  const [localeSearch, setLocaleSearch] = useState('');
  const [localLocale, setLocalLocale] = useState(readSavedLocale);
  const locale = controlledLocale || localLocale;
  const changeLocale = onLocaleChange || setLocalLocale;
  const displayArticle = getLocalizedArticle(article, locale);
  const [completed, setCompleted] = useState(() => readList(COMPLETED_KEY));
  const [bookmarks, setBookmarks] = useState(() => readList(BOOKMARKS_KEY));
  const [recent, setRecent] = useState(() => readList(RECENT_KEY));
  const [feedback, setFeedback] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [assistantStatus, setAssistantStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [serverStateLoaded, setServerStateLoaded] = useState(false);
  const [syncError, setSyncError] = useState('');
  const controllerRef = useRef(null);
  const inputRef = useRef(null);
  const assistantRef = useRef(null);
  const assistantToggleRef = useRef(null);
  const navigationToggleRef = useRef(null);
  const selectedLocale = getLocale(locale);
  const t = (source) => translate(locale, source);
  const selectedSectionForApi = article.sections.find((section, index) =>
    section.heading === selectedSection || displayArticle.sections[index].heading === selectedSection
  )?.heading || article.sections[0].heading;

  const config = useQuery({
    queryKey: ['config-status'],
    queryFn: async () => {
      const response = await apiFetch('/api/config-status');
      if (!response.ok) throw new Error('TERRA assistant status is unavailable.');
      return response.json();
    },
    staleTime: 60000,
    retry: 1,
  });
  const accountQuery = useQuery({
    queryKey: ['account-session'],
    queryFn: async () => {
      const response = await apiFetch('/api/auth/me');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Account session is unavailable.');
      return data;
    },
    retry: false,
    staleTime: 30000,
  });
  const learningStateQuery = useQuery({
    queryKey: ['account-learning-state', accountQuery.data?.user?.id],
    queryFn: async () => {
      const response = await apiFetch('/api/account/learning-state');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Saved learning progress is unavailable.');
      return data.state;
    },
    enabled: Boolean(accountQuery.data?.user),
    retry: false,
  });
  const aiReady = Boolean(config.data?.config?.assistant?.configured);

  const filteredArticles = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return search ? articles.filter((item) => articleSearchText(item, locale).includes(search)) : articles;
  }, [query, locale]);

  const filteredLocales = useMemo(() => {
    const search = localeSearch.trim().toLocaleLowerCase();
    return search ? selectableLocales.filter((item) => `${item.language} ${item.nativeName} ${item.locale}`.toLocaleLowerCase().includes(search)) : selectableLocales;
  }, [localeSearch]);

  useEffect(() => {
    try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* The selected locale remains active for this visit. */ }
  }, [locale]);

  useEffect(() => {
    if (!accountQuery.isFetched) return;
    if (accountQuery.error) {
      setSyncError(`Account progress sync is unavailable: ${accountQuery.error.message} Browser-local progress remains available.`);
      setServerStateLoaded(true);
      return;
    }
    if (!accountQuery.data?.user) {
      setServerStateLoaded(true);
      return;
    }
    if (learningStateQuery.error) {
      setSyncError(`Saved account progress could not be loaded: ${learningStateQuery.error.message}`);
      return;
    }
    if (!learningStateQuery.data) return;
    setBookmarks(learningStateQuery.data.bookmarks);
    setCompleted(learningStateQuery.data.completed);
    setRecent([article.id, ...learningStateQuery.data.recent.filter((id) => id !== article.id)].slice(0, 8));
    setSyncError('');
    setServerStateLoaded(true);
  }, [accountQuery.isFetched, accountQuery.error, accountQuery.data, learningStateQuery.data, learningStateQuery.error, article.id]);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPending(false);
    setRecent((current) => [article.id, ...current.filter((id) => id !== article.id)].slice(0, 8));
    setConversation([]);
    setAssistantStatus('');
    setFeedback('');
    setFeedbackMessage('');
    setSelectedSection('');
  }, [article.id]);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPending(false);
  }, [locale]);

  useEffect(() => {
    if (!articles.some((item) => item.id === articleId)) navigate('/learn/getting-started', { replace: true });
  }, [articleId, navigate]);

  useEffect(() => {
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch { /* Progress remains usable for this visit if storage is unavailable. */ }
  }, [completed, bookmarks, recent]);

  useEffect(() => {
    const userId = accountQuery.data?.user?.id;
    if (!userId || !serverStateLoaded || accountQuery.error || learningStateQuery.error) return undefined;
    const timeout = setTimeout(async () => {
      try {
        const response = await apiFetch('/api/account/learning-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookmarks, completed, recent }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'The server did not save your learning progress.');
        setSyncError('');
      } catch (error) {
        setSyncError(`Learning progress could not be synced: ${error.message}`);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [accountQuery.data?.user?.id, serverStateLoaded, accountQuery.error, learningStateQuery.error, bookmarks, completed, recent]);

  useEffect(() => {
    if (assistantOpen) assistantRef.current?.focus();
  }, [assistantOpen]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && assistantOpen) {
        setAssistantOpen(false);
        assistantToggleRef.current?.focus();
      } else if (event.key === 'Escape' && navigationOpen) {
        setNavigationOpen(false);
        navigationToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [assistantOpen, navigationOpen]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function navigateToArticle(id) {
    setNavigationOpen(false);
    navigate(`/learn/${id}`);
  }

  function ask(questionText, mode = 'question') {
    const prompt = questionText.trim();
    if (!prompt || pending) return;
    if (!aiReady) {
      setAssistantStatus(t('The generated guide is not configured on this server. Documentation search and articles are still available.'));
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);
    setAssistantStatus(t('TERRA Guide is preparing an article-grounded response…'));
    setQuestion('');
    const history = conversation.slice(-6).map(({ role, text }) => ({ role, content: text.slice(0, 2000) }));

    apiFetch('/api/guide/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        question: prompt,
        audience: mode === 'technical' ? 'researcher' : 'beginner',
        language: locale === 'en-US' || locale === 'en-GB' ? 'en' : locale === 'ur-PK' ? 'ur' : locale,
        context: { type: 'documentation', articleId: article.id, sectionHeading: selectedSectionForApi },
        history,
      }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'TERRA Guide could not answer this question.');
      if (controllerRef.current === controller) {
        setConversation((current) => [...current, { role: 'user', text: prompt }, { role: 'assistant', text: data.answer, source: data.source || `/learn/${article.id}`, generated: true }]);
        setAssistantStatus(t('AI-generated guidance is ready. Check the linked article and primary sources.'));
      }
    }).catch((error) => {
      if (error.name === 'AbortError') {
        if (controllerRef.current === controller) setAssistantStatus(t('Response stopped. You can ask another question.'));
        return;
      }
      if (controllerRef.current === controller) setAssistantStatus(error.message || t('TERRA Guide is unavailable. Try again later.'));
    }).finally(() => {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setPending(false);
      }
    });
  }

  function usePrompt(kind) {
    const prompts = {
      summary: `Summarize this article in three short, accurate bullet points. Article: ${article.title}`,
      simple: `Explain this article in simple language without changing its scientific meaning. Article: ${article.title}`,
      steps: `Give me step-by-step instructions based only on this article. Do not claim that you completed any action. Article: ${article.title}`,
      technical: `Explain the technical details, assumptions, and limitations in this article. Article: ${article.title}`,
      translate: `Translate the article below into ${selectedLocale.language} (${selectedLocale.locale}). Preserve scientific meaning, names, units, and warnings. Label this as an AI translation that needs review. Article: ${article.title}. Content: ${markdownText(article)}`,
    };
    ask(prompts[kind], kind === 'technical' ? 'technical' : 'question');
  }

  async function copyAnswer(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(String(index));
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setAssistantStatus(t('Copy is unavailable in this browser. You can select and copy the response text.'));
    }
  }

  function sendFeedback(value) {
    try {
      const saved = JSON.parse(localStorage.getItem('terra-learning-feedback') || '{}');
      const next = { ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}), [article.id]: value };
      localStorage.setItem('terra-learning-feedback', JSON.stringify(next));
      setFeedback(value);
      setFeedbackMessage(t('Thanks. This feedback is saved only in this browser; it is not sent to TERRA.'));
    } catch {
      setFeedbackMessage(t('Thanks for the response. Browser storage is unavailable, so it was not saved.'));
    }
  }

  function toggleList(setter, current) {
    setter(current.includes(article.id) ? current.filter((id) => id !== article.id) : [...current, article.id]);
  }

  const categoryNames = [...new Set(articles.map((item) => getLocalizedArticle(item, locale).category))];
  const translatedArticleCount = articles.filter((item) => {
    const entry = articleTranslations[locale]?.[item.id];
    return entry?.title && entry?.summary && entry.sections?.length === item.sections.length && entry.sections.every((section, index) => section.heading && (!item.sections[index].text || section.text) && (!item.sections[index].items || section.items?.length === item.sections[index].items.length));
  }).length;

  return <main className="page learning-page" dir={selectedLocale.direction}>
    <header className="learning-header">
      <div><p className="eyebrow"><span className="eyebrow-line" /> {t('TERRA GLOBAL HELP CENTER')}</p><h1>{t('TERRA Learning Center')}</h1><p>{t('Learn. Explore. Understand. Discover.')}</p></div>
      <div className="learning-language-control">
        <label htmlFor="learning-locale-search">{t('Language')}</label>
        <div className="learning-locale-search"><Search size={16} aria-hidden="true" /><input id="learning-locale-search" value={localeSearch} onChange={(event) => setLocaleSearch(event.target.value)} placeholder={t('Search languages and locales')} /></div>
        <select aria-label={t('Choose language or locale')} value={locale} onChange={(event) => changeLocale(event.target.value)}>
          {filteredLocales.map((item) => <option key={item.locale} value={item.locale}>{item.nativeName} · {item.locale} · {t(item.documentation)}</option>)}
        </select>
      </div>
    </header>
    {syncError && <p className="learning-coverage" role="status">{syncError}</p>}

    <div className="learning-coverage" role="status">
      <Languages size={17} aria-hidden="true" />
      <p><strong>{t(selectedLocale.documentation)}.</strong> {locale === 'ar'
        ? `ترجمة مقالات مركز التعلم إلى العربية قيد الإنجاز (${translatedArticleCount} من ${articles.length}). يظهر النص الأصلي بوضوح عند عدم توفر ترجمة. إجابات الذكاء الاصطناعي مولّدة وليست ترجمة معتمدة.`
        : locale === 'ja-JP'
          ? `学習センター記事の日本語翻訳は作業中です（${translatedArticleCount}/${articles.length}記事）。翻訳がない箇所では英語の原文を明示します。AI回答は自動生成で、確認済みの翻訳ではありません。`
        : locale === 'ur-PK'
        ? `${translatedArticleCount} از ${articles.length} دستاویزی مضامین اردو میں دستیاب ہیں۔ سائنسی نام، data set اور اکائیاں اصل صورت میں رکھی گئی ہیں؛ AI کے تیار کردہ جوابات الگ سے تصدیق شدہ نہیں ہوتے۔`
        : selectedLocale.locale === 'en-US' || selectedLocale.locale === 'en-GB'
          ? 'Articles are authored in English. This is the canonical article text.'
          : t('Articles and feature pages remain in English for this locale. AI translations and answers are generated and have not been independently reviewed.')}</p>
    </div>

    <div className="learning-layout">
      <aside id="learning-navigation" className={`learning-navigation${navigationOpen ? ' open' : ''}`}>
        <div className="learning-nav-title"><h2>{t('Documentation')}</h2><button className="learning-mobile-close" type="button" aria-label={t('Close documentation navigation')} onClick={() => setNavigationOpen(false)}><X size={18} /></button></div>
        <label className="learning-search-label" htmlFor="learning-search">{t('Search help articles')}</label>
        <div className="learning-search"><Search size={16} aria-hidden="true" /><input id="learning-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search topics, terms…')} /></div>
        <p className="learning-progress">{t('{done} of {total} tutorials completed').replace('{done}', String(completed.length)).replace('{total}', String(articles.length))}</p>
        <nav aria-label={t('Learning Center articles')}>
          {categoryNames.map((category) => {
            const categoryArticles = filteredArticles.filter((item) => getLocalizedArticle(item, locale).category === category);
            return categoryArticles.length ? <section className="learning-nav-group" key={category} aria-label={category}>
              <h3>{category}</h3>
              {categoryArticles.map((item) => <Link key={item.id} to={`/learn/${item.id}`} onClick={() => setNavigationOpen(false)} className={`learning-nav-link${item.id === article.id ? ' active' : ''}`} aria-current={item.id === article.id ? 'page' : undefined}>
                <span>{getLocalizedArticle(item, locale).title}</span>{completed.includes(item.id) && <Check size={14} aria-label={t('Completed')} />}
              </Link>)}
            </section> : null;
          })}
        </nav>
        {filteredArticles.length === 0 && <p className="learning-empty">{t('No articles match. Try a different term.')}</p>}
        {recent.length > 0 && <div className="learning-recent"><h3>{t('Recently viewed')}</h3>{recent.filter((id) => articles.some((item) => item.id === id)).slice(0, 3).map((id) => {
          const item = articles.find((candidate) => candidate.id === id);
          return <Link key={id} to={`/learn/${id}`}>{getLocalizedArticle(item, locale).title}</Link>;
        })}</div>}
        {bookmarks.length > 0 && <div className="learning-recent"><h3>{t('Bookmarked articles')}</h3>{bookmarks.filter((id) => articles.some((item) => item.id === id)).map((id) => {
          const item = articles.find((candidate) => candidate.id === id);
          return <Link key={id} to={`/learn/${id}`}>{getLocalizedArticle(item, locale).title}</Link>;
        })}</div>}
      </aside>

      <article className="learning-article" dir={selectedLocale.direction}>
        <div className="learning-article-toolbar">
          <button type="button" ref={navigationToggleRef} className="learning-mobile-nav" aria-expanded={navigationOpen} aria-controls="learning-navigation" onClick={() => setNavigationOpen((open) => !open)}><Menu size={16} /> {t('Contents')}</button>
          <span className="learning-article-category">{displayArticle.category}</span>
          <Link className="learning-feature-link" to={article.path}>{t('Open feature')} <ArrowRight size={14} aria-hidden="true" /></Link>
          <button type="button" className={`learning-icon-button${bookmarks.includes(article.id) ? ' selected' : ''}`} aria-label={bookmarks.includes(article.id) ? t('Remove bookmark') : t('Bookmark article')} aria-pressed={bookmarks.includes(article.id)} onClick={() => toggleList(setBookmarks, bookmarks)}><Bookmark size={17} /></button>
        </div>
        <header className="learning-article-header">
          <p className="eyebrow small-eyebrow">{t('LEARNING ARTICLE')}</p>
          <h2>{displayArticle.title}</h2>
          <p>{displayArticle.summary}</p>
          <div className="learning-article-meta"><span>{t('{minutes} min read').replace('{minutes}', String(article.minutes))}</span><span>{t(article.level)}</span><span>{t('Updated')} {new Intl.DateTimeFormat(locale).format(new Date(`${articlesData.updatedAt}T12:00:00Z`))}</span></div>
        </header>
        {['ar', 'ja-JP'].includes(locale) && (!articleTranslations[locale]?.[article.id]?.sections || articleTranslations[locale][article.id].sections.length < article.sections.length) && <aside className="learning-translation-note" lang={locale} dir={selectedLocale.direction} role="note"><Languages size={17} aria-hidden="true" /><span>{locale === 'ar' ? 'تُعرض بعض فقرات هذا الدليل باللغة الإنجليزية الأصلية لعدم توفر ترجمة عربية مراجعة لها بعد.' : '一部の本文は、確認済みの日本語訳がまだないため、英語の原文で表示しています。'}</span><small>{locale === 'ar' ? 'المصطلحات العلمية وأسماء مجموعات البيانات محفوظة كما وردت في مصادرها.' : '科学用語とデータセット名は、出典の表記を保っています。'}</small></aside>}
        <nav className="learning-toc" aria-label={t('On this page')}>
          <h3>{t('On this page')}</h3>
          <ul>{displayArticle.sections.map((section, index) => <li key={section.heading}><a href={`#${headingId(article.sections[index].heading)}`} onClick={() => setSelectedSection(section.heading)}>{section.heading}</a></li>)}</ul>
        </nav>
        <div className="learning-article-content">
          {displayArticle.sections.map((section, index) => <section key={article.sections[index].heading} id={headingId(article.sections[index].heading)} aria-labelledby={`${headingId(article.sections[index].heading)}-title`} onMouseEnter={() => setSelectedSection(section.heading)}>
            <h3 id={`${headingId(article.sections[index].heading)}-title`}>{section.heading}</h3>
            {section.text && <p>{section.text}</p>}
            {section.items && <ol>{section.items.map((item) => <li key={item}>{item}</li>)}</ol>}
            {section.link && <Link className="learning-inline-link" to={section.link.to}>{section.link.label}<ArrowRight size={15} aria-hidden="true" /></Link>}
            {index === 0 && <span className="visually-hidden">{t('Section')} {selectedSection || section.heading}</span>}
          </section>)}
        </div>
        <div className="learning-related"><h3>{t('Related articles')}</h3><div>{article.related.map((id) => {
          const related = articles.find((item) => item.id === id);
          const localizedRelated = related && getLocalizedArticle(related, locale);
          return localizedRelated && <Link key={id} to={`/learn/${id}`}><span>{localizedRelated.category}</span><strong>{localizedRelated.title}</strong><ArrowRight size={15} aria-hidden="true" /></Link>;
        })}</div></div>
        <div className="learning-article-actions">
          <button type="button" className="secondary" aria-pressed={completed.includes(article.id)} onClick={() => toggleList(setCompleted, completed)}><Check size={16} />{completed.includes(article.id) ? t('Completed') : t('Mark tutorial complete')}</button>
          <div className="learning-prev-next">
            {articleIndex > 0 && <button type="button" className="learning-page-link" onClick={() => navigateToArticle(articles[articleIndex - 1].id)}><ArrowLeft size={15} /> {t('Previous')}</button>}
            {articleIndex < articles.length - 1 && <button type="button" className="learning-page-link" onClick={() => navigateToArticle(articles[articleIndex + 1].id)}>{t('Next')} <ArrowRight size={15} /></button>}
          </div>
        </div>
        <section className="learning-feedback" aria-labelledby="learning-feedback-title">
          <h3 id="learning-feedback-title">{t('Was this article helpful?')}</h3>
          <div><button type="button" aria-pressed={feedback === 'yes'} onClick={() => sendFeedback('yes')}><ThumbsUp size={16} /> {t('Yes')}</button><button type="button" aria-pressed={feedback === 'no'} onClick={() => sendFeedback('no')}><ThumbsDown size={16} /> {t('No')}</button></div>
          <p role="status">{feedbackMessage || t('Feedback is stored only on this device and is not submitted to a support team.')}</p>
        </section>
      </article>

      <aside id="learning-assistant" ref={assistantRef} tabIndex="-1" className={`learning-assistant${assistantOpen ? ' mobile-open' : ''}${assistantCollapsed ? ' collapsed' : ''}`} aria-label={t('TERRA AI Guide')} dir={selectedLocale.direction}>
        <div className="learning-assistant-header">
          <div className="learning-assistant-identity"><span><Bot size={19} aria-hidden="true" /></span><div><h2>{t('TERRA Guide')}</h2><small>{aiReady ? t('Article-aware AI guide') : config.isLoading ? t('Checking assistant…') : t('AI not configured')}</small></div></div>
          <div className="learning-assistant-header-actions">
              <button type="button" className="learning-icon-button" aria-label={t('Clear conversation')} onClick={() => { controllerRef.current?.abort(); setConversation([]); setQuestion(''); setAssistantStatus(t('Conversation cleared.')); }} disabled={!conversation.length && !pending}><X size={16} /></button>
              <button type="button" className="learning-icon-button" aria-label={assistantCollapsed ? t('Expand assistant panel') : t('Collapse assistant panel')} onClick={() => setAssistantCollapsed((value) => !value)}>{assistantCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}</button>
              <button type="button" className="learning-icon-button learning-mobile-close" aria-label={t('Close TERRA Guide')} onClick={() => setAssistantOpen(false)}><X size={17} /></button>
          </div>
        </div>
        {!assistantCollapsed && <>
            <div className="learning-assistant-context"><span>{t('Reading now')}</span><strong>{displayArticle.title}</strong><a href={`#${headingId(selectedSectionForApi)}`}>{t('Open article section:')} {selectedSection || displayArticle.sections[0].heading}</a></div>
            <div className="learning-assistant-actions" aria-label={t('Quick guide actions')}>
              <button type="button" disabled={!aiReady || pending} onClick={() => usePrompt('summary')}>{t('Summarize')}</button>
              <button type="button" disabled={!aiReady || pending} onClick={() => usePrompt('simple')}>{t('Explain simply')}</button>
              <button type="button" disabled={!aiReady || pending} onClick={() => usePrompt('steps')}>{t('Give me steps')}</button>
              <button type="button" disabled={!aiReady || pending} onClick={() => usePrompt('translate')}>{t('Translate article')}</button>
          </div>
          <div className="learning-conversation" aria-live="polite" aria-relevant="additions text">
              {!conversation.length && <div className="learning-welcome"><Sparkles size={17} aria-hidden="true" /><p>{t('Ask about this article. Answers use a server-verified article and may still need scientific review.')}</p></div>}
            {conversation.map((message, index) => <div key={`${index}-${message.role}`} className={`learning-message ${message.role}`} dir={message.role === 'assistant' ? selectedLocale.direction : 'auto'}>
                <strong>{message.role === 'user' ? t('You') : t('TERRA Guide')}</strong>
              <p>{message.text}</p>
                {message.role === 'assistant' && <div className="learning-message-tools"><button type="button" onClick={() => copyAnswer(message.text, index)}><Copy size={14} />{copied === String(index) ? t('Copied') : t('Copy')}</button><Link to={message.source || `/learn/${article.id}`}>{t('Read source article')}</Link></div>}
            </div>)}
          </div>
          {assistantStatus && <p className="learning-assistant-status" role="status">{assistantStatus}</p>}
          <form className="learning-ask-form" onSubmit={(event) => { event.preventDefault(); ask(question); }}>
            <label htmlFor="learning-question">{t('Ask about')} {displayArticle.title}</label>
            <textarea id="learning-question" ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={3} placeholder={t('Ask a question about this article…')} disabled={!aiReady || pending} />
            <div className="learning-send-row">
              <span>{selectedLocale.nativeName}{selectedLocale.direction === 'rtl' ? ' · RTL' : ''}</span>
              {pending ? <button type="button" className="learning-stop" onClick={() => controllerRef.current?.abort()}><StopCircle size={16} /> {t('Stop response')}</button> : <button type="submit" className="primary" disabled={!aiReady || !question.trim()}><Send size={15} /> {t('Send')}</button>}
            </div>
          </form>
          <p className="learning-ai-note">{aiReady ? t('AI can make mistakes. Verify scientific details with the source links.') : t('Generated help requires the server-side Groq configuration. Articles and search remain available.')}</p>
        </>}
      </aside>
    </div>
    <button type="button" ref={assistantToggleRef} className="learning-mobile-assistant" aria-expanded={assistantOpen} aria-controls="learning-assistant" onClick={() => setAssistantOpen((open) => !open)}><MessageCircle size={18} /> {assistantOpen ? t('Close guide') : t('Ask TERRA Guide')}<ChevronDown size={15} /></button>
  </main>;
}
