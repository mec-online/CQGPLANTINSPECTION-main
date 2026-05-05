import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface AuthImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

export default function AuthImage({ src, alt, className, fallback }: AuthImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url: string | null = null;

    api.get(src, { responseType: 'blob' })
      .then((res) => {
        url = URL.createObjectURL(res.data);
        setBlobUrl(url);
      })
      .catch(() => setError(true));

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (error) {
    return fallback ? (
      <img src={fallback} alt={alt} className={className} />
    ) : (
      <div className={`bg-gray-100 flex items-center justify-center text-gray-400 text-sm ${className}`}>
        No image
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className={`bg-gray-100 animate-pulse ${className}`} />
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}
