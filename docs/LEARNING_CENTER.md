# TERRA Learning Center

The Learning Center is part of the React application at `/learn/:articleId`. Its structured article registry is [shared/learning-articles.json](../shared/learning-articles.json). The client uses it for navigation, search, and article display; the server uses it to validate article context sent to the Guide. Locale metadata is stored in [shared/learning-locales.json](../shared/learning-locales.json).

## Updating documentation

1. Verify the behavior in the current page, route, API, and source/method documentation before describing it.
2. Update the canonical English article in `shared/learning-articles.json`. Keep article IDs stable because routes and the server-side Guide allowlist use them.
3. Document only implemented features, sources, and limitations. Mark unimplemented capability as such.
4. Update the article's `updatedAt`, run the client and server tests, and verify links/search and affected routes.
5. Keep user-selectable locales in sync with `client/src/i18n.js`. A locale metadata record alone does not mean the application offers or fully supports that language.
6. Store interface translations in the appropriate shared UI catalogs and article translations in `shared/learning-article-translations.json`. Keep IDs, section order, and interpolation placeholders aligned with English.
7. Record locale coverage only for content that exists. Interface coverage and article coverage are separate measures.
8. Describe a translation as human-reviewed only after a fluent reviewer has checked meaning, units, warnings, and scientific terminology.

## Guide grounding and safety

The Learning Center sends an article ID and current section heading to `POST /api/guide/ask`; it does not send arbitrary article text. The server loads article text from the shared registry and rejects unknown article IDs or section headings before using them as context. If configured, the Guide can call the server-side Groq model. Generated answers can be incorrect and must be checked against the cited source. The Guide has no tool execution or arbitrary code/data access.

## Current coverage and limitations

- English is the canonical article language. The article registry contains 19 articles.
- Urdu (`ur-PK`) article translations are present for all 19 articles, with translated titles, summaries, sections, lists, and link labels. Automated structure checks confirm coverage and preserve article IDs/sections; that is not a substitute for fluent human editorial review.
- The user-facing language selector currently offers only English and Urdu. Arabic, Japanese, Spanish, and other locale records are not selectable as supported application languages.
- Urdu is right-to-left. RTL direction and localized content do not by themselves prove that every layout has passed human accessibility or device review.
- Scientific identifiers, units, proper names, source/provider content, and some dynamically returned data may remain in their original language to preserve source fidelity.
- Groq replies require server-side configuration and can be inaccurate. They are not reviewed translations or a replacement for article content.
- Article progress and preferences have local browser storage; account learning-state sync is available when signed in and the server database is healthy.
- The interactive globe and provider feeds have the limitations documented in their articles. Unsupported hazard layers are not presented as implemented features.
