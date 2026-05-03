import type { CSSProperties, ReactNode } from "react";

export type CircleAvatarProps = {
  sizePx: number;
  src?: string | undefined;
  alt?: string;
  fallback: ReactNode;
  fallbackBg?: string;
  fallbackColor?: string;
};

/**
 * Fixed-size circle: image uses object-fit cover inside a locked square wrapper
 * (avoids flex stretch / Ant Design Avatar ellipse issues).
 */
export function CircleAvatar({
  sizePx,
  src,
  alt = "avatar",
  fallback,
  fallbackBg = "#1677ff",
  fallbackColor = "#fff",
}: CircleAvatarProps) {
  const s = `${sizePx}px`;
  const wrap: CSSProperties = {
    width: s,
    height: s,
    minWidth: s,
    minHeight: s,
    maxWidth: s,
    maxHeight: s,
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-block",
    flexShrink: 0,
    verticalAlign: "middle",
  };
  const imgStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };
  const fontSize = Math.max(10, Math.round(sizePx * 0.36));

  return (
    <div style={wrap}>
      {src ? (
        <img src={src} alt={alt} style={imgStyle} />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: fallbackBg,
            color: fallbackColor,
            fontWeight: 600,
            fontSize,
            lineHeight: 1,
          }}
        >
          {fallback}
        </div>
      )}
    </div>
  );
}
