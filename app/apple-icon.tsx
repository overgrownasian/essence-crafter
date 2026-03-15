import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 42,
          background:
            "radial-gradient(circle at top, rgba(255,179,71,0.26), transparent 36%), linear-gradient(180deg, #24160d 0%, #120d09 100%)",
          color: "#f6efe6",
          fontFamily: "Georgia, serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 12,
            borderRadius: 32,
            border: "2px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 0 0 1px rgba(255,179,71,0.18)"
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 58, lineHeight: 1 }}>✨</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>EC</div>
        </div>
      </div>
    ),
    size
  );
}
