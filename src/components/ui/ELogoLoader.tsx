"use client";

import React from "react";

type ELogoLoaderProps = {
    size?: number; // px
    colorClass?: string; // Tailwind text color classes
    label?: string;
    className?: string;
    trackOpacity?: number; // 0..1
    // Optional idle animation hooks (optional; not required for normal use)
    idlePhase?: number;
    idleMode?: string;
};

export default function ELogoLoader({
    size = 56,
    colorClass = "text-indigo-600",
    label,
    className = "",
    trackOpacity = 0.18,
    idlePhase,
    idleMode,
}: ELogoLoaderProps) {
    const strokeWidth = Math.max(2, Math.round(size / 18));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dotR = Math.max(2, Math.round(size * 0.06));

    return (
        <div className={`flex flex-col items-center justify-center ${className}`} role="status" aria-live="polite">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className={colorClass}
                aria-hidden="true"
            >
                {/* Track ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    opacity={trackOpacity}
                />

                {/* Orbiting dot for subtle motion */}
                <g style={{ transformOrigin: `${size / 2}px ${size / 2}px` }} className="eloop-rotate">
                    <circle
                        cx={size / 2}
                        cy={(size / 2) - radius}
                        r={dotR}
                        fill="currentColor"
                        opacity={0.9}
                    />
                </g>

                {/* Center brand 'e' */}
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.round(size * 0.34)}
                    fontWeight={600}
                    fill="currentColor"
                    style={{ letterSpacing: -0.5, opacity: 0.95 }}
                >
                    e
                </text>

                {/* Scoped animation */}
                <style>{`
                    @keyframes eloopSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    .eloop-rotate { animation: eloopSpin 1.2s linear infinite; }
        `}</style>
            </svg>

            {label && <span className="mt-3 text-sm text-slate-600">{label}</span>}
        </div>
    );
}