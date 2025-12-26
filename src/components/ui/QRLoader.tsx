"use client";

import React from "react";

type QRLoaderProps = {
    size?: number; // px
    colorClass?: string; // Tailwind text color classes affect currentColor
    label?: string;
    className?: string;
    cells?: number; // grid dimension (NxN)
    brandChar?: string; // center character, defaults to 'e'
    showBorder?: boolean; // draw circular border ring
};

export default function QRLoader({
    size = 64,
    colorClass = "text-indigo-600",
    label,
    className = "",
    cells = 5,
    brandChar = "e",
    showBorder = true,
}: QRLoaderProps) {
    const cellCount = Math.max(3, Math.min(9, cells));
    const squares: Array<{ r: number; c: number; delay: number }> = [];
    for (let r = 0; r < cellCount; r++) {
        for (let c = 0; c < cellCount; c++) {
            // Diagonal wave timing (r + c) creates a reveal feel
            const delay = (r + c) * 90; // ms
            squares.push({ r, c, delay });
        }
    }

    const strokeWidth = Math.max(2, Math.round(size / 22));
    const radius = (size - strokeWidth) / 2;

    return (
        <div className={`flex flex-col items-center justify-center ${className}`} role="status" aria-live="polite">
            <div
                className={`relative ${colorClass}`}
                style={{ width: size, height: size }}
                aria-hidden
            >
                {/* Grid animation layer */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${cellCount}, 1fr)`,
                        gridTemplateRows: `repeat(${cellCount}, 1fr)`,
                        width: "100%",
                        height: "100%",
                        gap: Math.round(size * 0.04),
                    }}
                >
                    {squares.map(({ delay }, idx) => (
                        <div
                            key={idx}
                            style={{
                                width: "100%",
                                height: "100%",
                                background: "currentColor",
                                borderRadius: 2,
                                opacity: 0.12,
                                animationName: "qrPulse",
                                animationDuration: "1.3s",
                                animationTimingFunction: "ease-in-out",
                                animationDelay: `${delay}ms`,
                                animationIterationCount: "infinite",
                                animationDirection: "alternate",
                            }}
                        />
                    ))}
                </div>

                {/* Circular border ring */}
                {showBorder && (
                    <svg
                        width={size}
                        height={size}
                        viewBox={`0 0 ${size} ${size}`}
                        className="absolute inset-0"
                    >
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            opacity={0.25}
                        />
                    </svg>
                )}

                {/* Center brand character */}
                {brandChar && (
                    <span
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
                        style={{
                            fontSize: Math.round(size * 0.36),
                            fontWeight: 700,
                            color: "currentColor",
                            letterSpacing: -0.5,
                            lineHeight: 1,
                            opacity: 0.9,
                            textShadow: "0 1px 0 rgba(0,0,0,0.05)",
                        }}
                    >
                        {brandChar}
                    </span>
                )}
            </div>
            {label && <span className="mt-3 text-sm text-slate-600">{label}</span>}

            {/* Lightweight scoped styles for animation */}
            <style>{`
        @keyframes qrPulse {
          0% { transform: scale(0.95); opacity: 0.12; }
          50% { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(0.97); opacity: 0.2; }
        }
      `}</style>
        </div>
    );
}
