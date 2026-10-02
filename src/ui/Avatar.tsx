import { useState } from 'react';

// Your photo, or your initial if there isn't one (or it can't load offline).
export function Avatar({ url, name, size, className = '' }: { url: string | null; name: string; size: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = url && failed !== url;
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden font-extrabold ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {showPhoto
        ? <img src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setFailed(url)} className="size-full object-cover" />
        : name.charAt(0).toUpperCase()}
    </span>
  );
}
