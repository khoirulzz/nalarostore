import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { authorizationHeaders } from "../lib/firebase";

export function MediaImage({
  src,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const local =
    typeof src === "string" &&
    src.startsWith("/api/media/") &&
    /^\/(app|admin|preview)(?:\/|$)/.test(window.location.pathname);
  const [url, setURL] = useState<string>();
  useEffect(() => {
    if (!local || !src) return;
    setURL(undefined);
    const abort = new AbortController();
    let blobURL: string | undefined;
    void authorizationHeaders()
      .then((headers) => fetch(src, { headers, signal: abort.signal }))
      .then(async (r) => {
        if (!r.ok) throw Error("Media unavailable");
        const blob = await r.blob();
        if (!abort.signal.aborted) {
          blobURL = URL.createObjectURL(blob);
          setURL(blobURL);
        }
      })
      .catch(() => {});
    return () => {
      abort.abort();
      if (blobURL) URL.revokeObjectURL(blobURL);
    };
  }, [local, src]);
  return <img {...props} src={local ? url : src} />;
}
