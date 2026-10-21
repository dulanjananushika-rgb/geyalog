import assert from 'node:assert/strict';
import test from 'node:test';
import { supportedLanguages, t, translations } from '../src/i18n/index.ts';

test('i18n dictionary contains complete translations for all supported languages', () => {
  const enKeys = Object.keys(translations.en);
  assert.ok(enKeys.length > 20);

  for (const lang of supportedLanguages) {
    const dict = translations[lang.code];
    assert.ok(dict, `Language ${lang.code} dictionary must exist`);

    for (const key of enKeys) {
      assert.ok(
        typeof dict[key] === 'string' && dict[key].length > 0,
        `Key ${key} missing or empty in language ${lang.code}`,
      );
    }
  }
});

test('t helper translates keys and falls back gracefully', () => {
  assert.equal(t('save', 'en'), 'Save');
  assert.equal(t('save', 'si'), 'සුරකින්න');
  assert.equal(t('save', 'ta'), 'சேமிக்கவும்');
  // fallback test
  assert.equal(t('weatherSunny', 'si'), 'හිරු එළිය සහිත / වියළි');
});
