/**
 * Which browser opened the web app (#526), as a family the log keeps instead
 * of the user agent itself, which carries versions and device models nobody
 * needs to tell the cases apart.
 *
 * The cases it tells apart are the ones a session lives or dies by: a browser
 * keeps the session of what was signed in in it, and only in it, so a person
 * moving between Chrome, Samsung Internet and the embedded browser of another
 * app (an e-mail, a chat, an assistant) is asked to sign in in each.
 */
export function webClientOf(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  const platform = /Android/.test(userAgent)
    ? 'android'
    : /iPhone|iPad|iPod/.test(userAgent)
      ? 'ios'
      : 'desktop';
  return `${browserOf(userAgent, platform)}-${platform}`;
}

function browserOf(userAgent: string, platform: string): string {
  // An app's embedded browser: Android's WebView says `wv`, and on iOS one
  // is a WebKit that does not call itself Safari.
  if (platform === 'android' && /;\s*wv\)/.test(userAgent)) return 'embedded';
  if (platform === 'ios' && !/Safari\//.test(userAgent)) return 'embedded';
  if (/SamsungBrowser\//.test(userAgent)) return 'samsung';
  if (/Edg(A|iOS)?\//.test(userAgent)) return 'edge';
  if (/Firefox\/|FxiOS\//.test(userAgent)) return 'firefox';
  if (/Chrome\/|CriOS\//.test(userAgent)) return 'chrome';
  if (/Safari\//.test(userAgent)) return 'safari';
  return 'other';
}
