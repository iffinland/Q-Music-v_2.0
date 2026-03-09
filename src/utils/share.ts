interface QortalWindow extends Window {
  _qdnBase?: string;
}

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

export const buildShareLink = (location: Location = window.location) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const qortalWindow = window as QortalWindow;
  const qdnBase = qortalWindow._qdnBase;

  if (typeof qdnBase === 'string' && qdnBase.startsWith('/render/')) {
    const qdnSegments = trimSlashes(qdnBase).split('/');
    const routePath = location.pathname.startsWith(qdnBase)
      ? location.pathname.slice(qdnBase.length)
      : location.pathname;
    const routeSegments = trimSlashes(routePath).split('/').filter(Boolean);
    const sharePath = [...qdnSegments.slice(1), ...routeSegments].join('/');

    return `qortal://${sharePath}${location.search || ''}${location.hash || ''}`;
  }

  return location.href;
};

export const copyToClipboard = async (value: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};
