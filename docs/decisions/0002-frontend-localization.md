# ADR 0002: runtime frontend localization

Status: accepted for the Angular starter.

## Context and decision

The UI must support English, German and Arabic, switch language on the current route, remember the selection and use RTL for Arabic. Use **Transloco 8.4.0**, whose stable peer requirements support the selected Angular 22 release. The upstream v9 installation guide currently describes an alpha; this starter uses the stable v8 API and no prerelease dependencies.

Bundle the three small JSON dictionaries with the application and serve them through Transloco's loader interface. This makes the shell usable without a translation HTTP request and prevents an unavailable translation endpoint from interrupting a language switch. Larger feature dictionaries can be split later when measured size warrants it.

LanguageService validates stored language codes, defaults to English, updates Transloco and document lang/dir, and persists the preference when browser storage is available. Storage failures do not block use. A router TitleStrategy maintains the translated page title plus app name on both navigation and language changes. Angular CDK's Dir directive propagates direction changes to Material components and overlays. Locale formatting uses explicit Intl locales en-GB/de-DE/ar-JO; the preferences date is an example formatted in UTC, not a new service-timezone rule.

## Consequences

- All translated UI keys belong in all three dictionaries; completeness tests catch missing/empty entries.
- Language selection changes neither route identifiers nor API contracts, and must preserve future in-progress forms.
- Browser tests exercise an openable Material language menu after RTL switching, saved selection after reload and German/Arabic layouts.
- Display language does not translate stored names/comments or determine trip timezone. Future API/domain localization remains a separate feature decision.
- NgRx business state is added with the first actual business feature. The small localization preference is managed by a focused signal-based service.

References: [Transloco](https://jsverse.gitbook.io/transloco), [Angular compatibility](https://angular.dev/reference/versions).
