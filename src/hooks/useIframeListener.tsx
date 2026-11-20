import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnumTheme, themeAtom } from '../state/global/system';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n/i18n';
import {
  internalNavigationPath,
  isTrustedHubMessage,
} from '../utils/hubMessages';
export const useIframe = () => {
  const setTheme = useSetAtom(themeAtom),
    { i18n } = useTranslation(),
    navigate = useNavigate();
  useEffect(() => {
    const initial = window as unknown as {
      _qdnTheme?: string;
      _qdnLang?: string;
    };
    if (initial._qdnTheme === 'dark' || initial._qdnTheme === 'light')
      setTheme(initial._qdnTheme === 'dark' ? EnumTheme.DARK : EnumTheme.LIGHT);
    if (initial._qdnLang && supportedLanguages.includes(initial._qdnLang))
      void i18n.changeLanguage(initial._qdnLang);
    const receive = (event: MessageEvent) => {
      if (!isTrustedHubMessage(event)) return;
      const data = event.data;
      if (data.action === 'NAVIGATE_TO_PATH') {
        const path = internalNavigationPath(data.path);
        if (!path) return;
        navigate(path);
        window.parent.postMessage(
          { action: 'NAVIGATION_SUCCESS', path },
          event.origin === 'null' ? '*' : event.origin
        );
      } else if (
        data.action === 'THEME_CHANGED' &&
        (data.theme === 'dark' || data.theme === 'light')
      )
        setTheme(data.theme === 'dark' ? EnumTheme.DARK : EnumTheme.LIGHT);
      else if (
        data.action === 'LANGUAGE_CHANGED' &&
        typeof data.language === 'string' &&
        supportedLanguages.includes(data.language)
      )
        void i18n.changeLanguage(data.language);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [navigate, setTheme, i18n]);
  return { navigate };
};
