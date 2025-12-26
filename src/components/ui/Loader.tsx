"use client";

import React from "react";

type LoaderProps = {
    size?: number; // px
    colorClass?: string; // Tailwind text color classes
    label?: string;
    className?: string;
};

export default function Loader({ size = 48, colorClass = "text-indigo-600", label, className = "" }: LoaderProps) {
    const strokeWidth = Math.max(2, Math.round(size / 12));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className={`flex flex-col items-center justify-center ${className}`} role="status" aria-live="polite">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className={`animate-spin ${colorClass}`}
                aria-hidden="true"
            >
                <defs>
                    <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                        <stop offset="50%" stopColor="currentColor" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
                    </linearGradient>
                </defs>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="url(#loaderGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference * 0.3} ${circumference}`}
                    strokeDashoffset={circumference * 0.25}
                />
            </svg>
            {label && <span className="mt-3 text-sm text-slate-600">{label}</span>}
        </div>
    );
}
