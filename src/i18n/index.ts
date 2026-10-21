export const supportedLanguages = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'si', label: 'Sinhala', nativeLabel: 'සිංහල' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]['code'];

// Translation dictionaries can be added by feature as localization is rolled out.
// Until then, the application UI uses English consistently.
export function getLanguageLabel(code: LanguageCode): string {
  return supportedLanguages.find(language => language.code === code)?.label ?? 'English';
}
