"use client";

import { useCallback, useState } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { LoadingScreen } from "./LoadingScreen";

export function PageIntro() {
    const [isLoaded, setIsLoaded] = useState(false);

    const handleLoadingComplete = useCallback(() => {
        setIsLoaded(true);
    }, []);
    return (
        <>
            <LoadingScreen onComplete={handleLoadingComplete} />

            <div
                className="intro-content"
                data-loaded={isLoaded}
            >
                <Header />
                <Hero />
            </div>
        </>
    );
}
