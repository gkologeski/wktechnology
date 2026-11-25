import { useEffect, useRef } from "react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  VISUAL_ICON_PATHS,
  type VisualBrandKit,
  type VisualElement,
} from "@/lib/proposals/visual-design";

type VisualElementViewProps = {
  element: VisualElement;
  brandKit: VisualBrandKit;
  pxPerMm: number;
  signedUrls: Record<string, string>;
  editing: boolean;
  onCommitText?: (text: string) => void;
  onEndEdit?: () => void;
};

function shadowCss(shadow: VisualElement["style"]["shadow"]): string | undefined {
  if (shadow === "sm") return "0 2px 8px rgba(15,23,42,0.08)";
  if (shadow === "md") return "0 6px 18px rgba(15,23,42,0.12)";
  if (shadow === "lg") return "0 12px 28px rgba(15,23,42,0.18)";
  return undefined;
}

function renderInlineText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*\n]+\*\*)/g);
    return (
      <span key={lineIdx}>
        {parts.map((part, i) =>
          part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
        {lineIdx < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

export function VisualElementView({
  element: el,
  brandKit,
  pxPerMm,
  signedUrls,
  editing,
  onCommitText,
  onEndEdit,
}: VisualElementViewProps) {
  const { can } = usePermissions();
  const canEditText = ["own", "team", "workspace"].some(
    (s) =>
      can(`techsales.proposal_templates.create.${s}`) ||
      can(`techsales.proposal_templates.update.${s}`) ||
      can(`techsales.proposals.create.${s}`) ||
      can(`techsales.proposals.update.${s}`),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ptToPx = (pt: number) => pt * 0.352778 * pxPerMm;

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const s = el.style;
  const font = s.fontFamily ?? (el.type === "heading" ? brandKit.headingFont : brandKit.bodyFont);
  const common: React.CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    opacity: s.opacity ?? 1,
    backgroundColor: s.bgColor,
    border: s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor ?? "#CBD5E1"}` : undefined,
    borderRadius: s.borderRadius ? `${s.borderRadius * pxPerMm}px` : undefined,
    boxShadow: shadowCss(s.shadow),
    padding: s.paddingMm ? `${s.paddingMm * pxPerMm}px` : undefined,
  };

  if (el.type === "heading" || el.type === "text") {
    const textStyle: React.CSSProperties = {
      ...common,
      fontFamily: `'${font}', system-ui, -apple-system, sans-serif`,
      fontSize: `${ptToPx(s.fontSize ?? (el.type === "heading" ? 22 : 11))}px`,
      fontWeight: Number(s.fontWeight ?? (el.type === "heading" ? "800" : "400")),
      color: s.textColor ?? brandKit.textColor,
      textAlign: s.textAlign ?? "left",
      lineHeight: s.lineHeight ?? (el.type === "heading" ? 1.18 : 1.5),
      letterSpacing: s.letterSpacing ? `${s.letterSpacing * (pxPerMm / 3.78)}px` : undefined,
      textTransform: s.uppercase ? "uppercase" : undefined,
      overflow: "hidden",
      wordBreak: "break-word",
    };

    if (editing && canEditText) {
      return (
        <textarea
          ref={textareaRef}
          aria-label={`Editar ${el.name}`}
          value={el.props.text}
          onChange={(e) => onCommitText?.(e.target.value)}
          onBlur={() => onEndEdit?.()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onEndEdit?.();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            ...textStyle,
            resize: "none",
            outline: "none",
            background: s.bgColor ?? "rgba(255,255,255,0.92)",
          }}
        />
      );
    }

    return <div style={textStyle}>{renderInlineText(el.props.text)}</div>;
  }

  if (el.type === "rect") {
    const stripe =
      el.props.accentStripe === "left"
        ? {
            borderLeft: `${Math.max(2, 0.9 * pxPerMm)}px solid ${el.props.accentColor ?? brandKit.primaryColor}`,
          }
        : el.props.accentStripe === "top"
          ? {
              borderTop: `${Math.max(2, 0.9 * pxPerMm)}px solid ${el.props.accentColor ?? brandKit.primaryColor}`,
            }
          : {};
    return <div style={{ ...common, ...stripe }} />;
  }

  if (el.type === "circle") {
    return <div style={{ ...common, borderRadius: "9999px" }} />;
  }

  if (el.type === "line" || el.type === "divider") {
    const color = s.bgColor ?? brandKit.primaryColor;
    const stroke = el.props.strokeStyle ?? "solid";
    if (stroke === "solid") {
      return <div style={{ ...common, backgroundColor: color }} />;
    }
    return (
      <div
        style={{
          ...common,
          backgroundColor: "transparent",
          borderTop: `${Math.max(1, el.h * pxPerMm)}px ${stroke} ${color}`,
        }}
      />
    );
  }

  if (el.type === "icon") {
    const paths = VISUAL_ICON_PATHS[el.props.icon] ?? VISUAL_ICON_PATHS.sparkles;
    return (
      <div style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg
          viewBox="0 0 24 24"
          width="100%"
          height="100%"
          fill="none"
          stroke={s.textColor ?? brandKit.primaryColor}
          strokeWidth={el.props.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths.map((d, idx) => (
            <path key={idx} d={d} />
          ))}
        </svg>
      </div>
    );
  }

  if (el.type === "image") {
    if (el.props.bindLogo === "client") {
      return (
        <div
          style={{
            ...common,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed #94A3B8",
            color: "#64748B",
            fontFamily: `'${brandKit.bodyFont}', system-ui, sans-serif`,
            fontWeight: 500,
            fontSize: `${ptToPx(8.5)}px`,
            textAlign: "center",
            padding: "2px 4px",
          }}
        >
          Logo do cliente (automático)
        </div>
      );
    }
    const src =
      (el.props.bindLogo === "contracting" && brandKit.logoUrl) ||
      (el.props.storagePath ? signedUrls[el.props.storagePath] : undefined) ||
      el.props.src;
    if (!src) {
      return (
        <div
          style={{
            ...common,
            display: "flex",
            alignItems: "center",
            justifyContent: el.props.bindLogo !== "none" ? "flex-start" : "center",
            border: el.props.bindLogo !== "none" ? undefined : "1px dashed #94A3B8",
            color: el.props.bindLogo !== "none" ? brandKit.primaryColor : "#64748B",
            fontFamily: `'${brandKit.headingFont}', system-ui, sans-serif`,
            fontWeight: el.props.bindLogo !== "none" ? 800 : 500,
            fontSize: `${ptToPx(el.props.bindLogo !== "none" ? 13 : 9)}px`,
          }}
        >
          {el.props.bindLogo !== "none"
            ? brandKit.legalEntityName || "LOGO DA EMPRESA"
            : "Imagem (clique para enviar)"}
        </div>
      );
    }
    return (
      <div style={{ ...common, overflow: "hidden" }}>
        <img
          src={src}
          alt={el.props.alt}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: el.props.fit,
            objectPosition: el.props.bindLogo !== "none" ? "left center" : "center",
            display: "block",
          }}
        />
      </div>
    );
  }

  if (el.type === "table") {
    const hBg = el.props.headerBg ?? brandKit.darkSurfaceColor;
    const hCol = el.props.headerColor ?? "#FFFFFF";
    const stripe = el.props.stripeBg ?? brandKit.lightSurfaceColor;
    const bCol = el.props.borderColor ?? "#E5E7EB";
    const fs = ptToPx(s.fontSize ?? 9.5);
    return (
      <div
        style={{
          ...common,
          overflow: "hidden",
          fontFamily: `'${font}', system-ui, sans-serif`,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${bCol}` }}>
          <thead>
            <tr>
              {el.props.headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "left",
                    padding: `${2.2 * pxPerMm}px ${2.8 * pxPerMm}px`,
                    backgroundColor: hBg,
                    color: hCol,
                    fontWeight: 700,
                    fontSize: `${fs}px`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {el.props.rows.map((r, rIdx) => (
              <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 1 ? stripe : "#FFFFFF" }}>
                {r.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      padding: `${2.2 * pxPerMm}px ${2.8 * pxPerMm}px`,
                      borderTop: `1px solid ${bCol}`,
                      color: s.textColor ?? brandKit.textColor,
                      fontSize: `${fs}px`,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // price_card
  const isDark = el.props.variant === "dark";
  const isAccent = el.props.variant === "accent";
  const bg =
    s.bgColor ??
    (isDark
      ? brandKit.darkSurfaceColor
      : isAccent
        ? brandKit.primaryColor
        : brandKit.lightSurfaceColor);
  const fg = s.textColor ?? (isDark || isAccent ? "#FFFFFF" : brandKit.textColor);
  const mutedFg = isDark || isAccent ? "rgba(255,255,255,0.82)" : brandKit.mutedColor;
  const eyebrowCol =
    el.props.eyebrowColor ?? (isAccent ? "rgba(255,255,255,0.88)" : brandKit.accentColor);
  const padPx = (s.paddingMm ?? 6) * pxPerMm;
  return (
    <div
      style={{
        ...common,
        backgroundColor: bg,
        color: fg,
        padding: `${padPx}px`,
        fontFamily: `'${font}', system-ui, sans-serif`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: `${1.4 * pxPerMm}px`,
        overflow: "hidden",
      }}
    >
      {el.props.eyebrow && (
        <div
          style={{
            fontSize: `${ptToPx(8.5)}px`,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: eyebrowCol,
          }}
        >
          {el.props.eyebrow}
        </div>
      )}
      {el.props.title && (
        <div style={{ fontSize: `${ptToPx(16)}px`, fontWeight: 800, lineHeight: 1.15 }}>
          {el.props.title}
        </div>
      )}
      {el.props.price && (
        <div style={{ fontSize: `${ptToPx(22)}px`, fontWeight: 800, lineHeight: 1.1 }}>
          {el.props.price}
        </div>
      )}
      {el.props.subtitle && (
        <div style={{ fontSize: `${ptToPx(9.5)}px`, lineHeight: 1.4, color: mutedFg }}>
          {renderInlineText(el.props.subtitle)}
        </div>
      )}
    </div>
  );
}
