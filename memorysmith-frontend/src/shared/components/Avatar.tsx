import { useEffect, useState } from 'react';
import { avatarUrl } from '../auth/gravatar';

interface AvatarProps {
  email: string;
  size?: number;
}

export function Avatar({ email, size = 32 }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void avatarUrl(email, size * 2).then((u) => {
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
