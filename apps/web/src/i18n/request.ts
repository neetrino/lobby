import { defaultLocale, supportedLocales, type Locale } from '@lobby/contracts';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

function isLocale(value: string | undefined): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
