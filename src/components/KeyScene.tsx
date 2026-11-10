"use client";

import { Component, type ReactNode } from "react";
import KeyViewer from "./catalog/KeyViewer";

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (this.state.failed) {
            return <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p>KEYモデルの読み込み、または3D表示に失敗しました。</p>
                <button type="button" onClick={() => window.location.reload()} className="rounded border px-4 py-2 text-sm">再読み込み</button>
            </div>;
        }
        return this.props.children;
    }
}

export function KeyScene() {
    return <div className="relative h-[65vh] min-h-[360px] overflow-hidden rounded border border-black/10 bg-white">
        <SceneErrorBoundary><KeyViewer /></SceneErrorBoundary>
    </div>;
}
