import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512
};

export const contentType = "image/png";

export default function Icon() {
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
          background:
            "radial-gradient(circle at top, rgba(255,179,71,0.24), transparent 36%), linear-gradient(180deg, #24160d 0%, #120d09 100%)",
          color: "#f6efe6",
          fontFamily: "Georgia, serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 36,
            borderRadius: 84,
            border: "3px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 0 0 2px rgba(255,179,71,0.18)"
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14
          }}
        >
          <div style={{ fontSize: 160, lineHeight: 1 }}>✨</div>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: 3 }}>EC</div>
        </div>
      </div>
    ),
    size
  );
}
