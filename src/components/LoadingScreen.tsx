"use client";

import { useProgress } from "@react-three/drei";
import { useState, useEffect } from "react";

type LoadingScreenProps = {
    onComplete: () => void;
};

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
    const { progress } = useProgress();
    const [isVisible, setIsVisible] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        if (progress < 100) {
            return;
        }

        const leaveTimer = window.setTimeout(() => {
            setIsLeaving(true);
            onComplete();
        }, 250);

        return () => {
            window.clearTimeout(leaveTimer);
        };
    }, [progress, onComplete]);

    if (!isVisible) {
        return null;
    }

    return (
        <div
            className={`
            fixed inset-0 z-50
            flex items-center justify-center
            bg-[#f1f0ec]
            transition-opacity duration-700 ease-out
            ${isLeaving ? "opacity-0" : "opacity-100"}
            `}
            onTransitionEnd={(event) => {
                if (event.propertyName === "opacity" && isLeaving) {
                    setIsVisible(false);
                }
            }}
        >
            <div className="flex w-[240px] flex-col items-center">
                <p className="text-sm font-medium tracking-[0.35em">MUDA</p>

                <div className="mt-6 h-px w-full overflow-hidden bg-black/10 transition-[width] duration-300 ease-out">
                    <div
                        className="h-full bg-black"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="mt-3 text-[10px] tracking-[0.2em] text-black/40 ">
                    {Math.round(progress)}%
                </p>
            </div>
        </div>
    );
}
