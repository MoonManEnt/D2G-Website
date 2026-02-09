import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Dispute2Go - AI-Powered Credit Repair Software";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
                              radial-gradient(circle at 80% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)`,
          }}
        />

        {/* Logo/Shield icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            background: "linear-gradient(135deg, #3b82f6, #10b981)",
            borderRadius: 24,
            marginBottom: 32,
            boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)",
          }}
        >
          <span style={{ fontSize: 64, color: "white", fontWeight: 800 }}>D2G</span>
        </div>

        {/* Main title */}
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "white",
            margin: 0,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Dispute2Go
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 32,
            color: "#94a3b8",
            margin: 0,
            marginBottom: 48,
            textAlign: "center",
          }}
        >
          AI-Powered Credit Repair Software
        </p>

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: 40,
          }}
        >
          {["AI Letters", "Auto Tracking", "Bureau Compliance"].map((feature) => (
            <div
              key={feature}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(255, 255, 255, 0.05)",
                padding: "12px 24px",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                }}
              />
              <span style={{ color: "#e2e8f0", fontSize: 20 }}>{feature}</span>
            </div>
          ))}
        </div>

        {/* URL */}
        <p
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 24,
            color: "#64748b",
            margin: 0,
          }}
        >
          dispute2go.com
        </p>
      </div>
    ),
    {
      ...size,
    }
  );
}
