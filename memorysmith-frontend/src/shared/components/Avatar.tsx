import { useEffect, useState } from 'react';

// Gravatar accepts SHA-256 hashes of the lowercased, trimmed e-mail.
async function gravatarUrl(email: string, size: number): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=${size}`;
}

interface AvatarProps {
  email: string;
  size?: number;
}

export function Avatar({ email, size = 32 }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void gravatarUrl(email, size * 2).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [email, size]);

  if (!url)
    return <span className="avatar avatar-fallback" style={{ width: size, height: size }} />;
  return (
    <img
      className="avatar"
      src={url}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
    />
  );
}
