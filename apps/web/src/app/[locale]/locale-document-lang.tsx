'use client';

import { useEffect } from 'react';

/** Root layout owns `<html>`, so the locale segment sets the document language here. */
export function LocaleDocumentLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
