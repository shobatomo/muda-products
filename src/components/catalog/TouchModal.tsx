"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";
import type { DialAudio } from "@/lib/dial-audio";
import styles from "./TouchModal.module.css";

class ViewerBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { this.props.onError(); }
    render() {
        return this.state.failed ? <p className={styles.error} role="alert">3D を表示できませんでした。ページを再読み込みして、もう一度お試しください。</p> : this.props.children;
    }
}

export function TouchModal({ name, children, onClose, audio }: { name: string; children: ReactNode; onClose: () => void; audio: DialAudio | null }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const dialog = dialogRef.current!;
        const opener = document.activeElement as HTMLElement | null;
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const body = document.body;
        const previous = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow };
        Object.assign(body.style, { position: "fixed", top: `-${scrollY}px`, left: `-${scrollX}px`, width: "100%", overflow: "hidden" });
        dialog.showModal();
        closeRef.current?.focus();
        const pause = () => audio?.pause();
        const visibility = () => { if (document.hidden) pause(); };
        window.addEventListener("pagehide", pause);
        window.addEventListener("blur", pause);
        document.addEventListener("visibilitychange", visibility);
        return () => {
            window.removeEventListener("pagehide", pause);
            window.removeEventListener("blur", pause);
            document.removeEventListener("visibilitychange", visibility);
            dialog.close();
            Object.assign(body.style, previous);
            window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        };
    }, [audio]);

    return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="touch-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
        <div className={styles.inner}>
            <header className={styles.header}>
                <h2 id="touch-title" className={styles.title}>{name}</h2>
                <button ref={closeRef} type="button" className={styles.close} aria-label="3D ビューを閉じる" onClick={onClose}>×</button>
            </header>
            <div className={styles.stage}><ViewerBoundary onError={() => audio?.pause()}>{children}</ViewerBoundary></div>
        </div>
    </dialog>;
}
