// Modal-only audio lifecycle. The HERO keeps its existing implementation.
// Never opt into playback/HTMLMediaElement: silent mode must remain respected.
export type DialAudio = ReturnType<typeof prepareDialAudio>;

export function prepareDialAudio() {
    let context: AudioContext | null = null;
    let buffer: AudioBuffer | null = null;
    let disposed = false;
    let paused = false;
    let restoreSession = () => {};
    const controller = new AbortController();
    const sources = new Set<AudioScheduledSourceNode>();
    try {
        const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (session) {
            const wasAutomatic = session.type === "auto";
            session.type = "ambient";
            // Do not leave a modal-specific session setting on the unchanged HERO.
            restoreSession = () => { if (wasAutomatic && session.type === "ambient") session.type = "auto"; };
        }
        context = new AudioContext();
        // Called synchronously from the explicit open gesture, before any import.
        void context.resume().catch(() => undefined);
        const current = context;
        void fetch("/sounds/ratchet_sound.WAV", { signal: controller.signal })
            .then((response) => { if (!response.ok) throw new Error("Audio unavailable"); return response.arrayBuffer(); })
            .then((data) => current.decodeAudioData(data))
            .then((decoded) => { if (!disposed) buffer = decoded; })
            .catch(() => undefined);
    } catch {
        // Audio is optional. A rejected audio policy must not prevent the viewer.
    }

    function stopSources() {
        for (const source of sources) {
            try { source.stop(); } catch { /* Already ended. */ }
            source.disconnect();
        }
        sources.clear();
    }

    return {
        resume() {
            if (disposed || !context || document.hidden) return;
            paused = false;
            if (context.state !== "closed") void context.resume().catch(() => undefined);
        },
        play(count = 1) {
            if (disposed || paused || document.hidden || context?.state !== "running") return;
            for (let index = 0; index < Math.min(count, 4); index++) {
                const startAt = context.currentTime + index * 0.009;
                const gain = context.createGain();
                const source = buffer ? context.createBufferSource() : context.createOscillator();
                if (source instanceof AudioBufferSourceNode) {
                    source.buffer = buffer;
                    gain.gain.value = 0.3;
                } else {
                    source.type = "square";
                    source.frequency.setValueAtTime(1400, startAt);
                    source.frequency.exponentialRampToValueAtTime(520, startAt + 0.022);
                    gain.gain.setValueAtTime(0.045, startAt);
                    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.022);
                }
                source.connect(gain);
                gain.connect(context.destination);
                sources.add(source);
                source.addEventListener("ended", () => { sources.delete(source); source.disconnect(); gain.disconnect(); }, { once: true });
                source.start(startAt);
                if (source instanceof OscillatorNode) source.stop(startAt + 0.022);
            }
        },
        pause() {
            paused = true;
            stopSources();
            if (context && context.state !== "closed") void context.suspend().catch(() => undefined);
        },
        dispose() {
            disposed = true;
            controller.abort();
            stopSources();
            buffer = null;
            if (context && context.state !== "closed") void context.close().catch(() => undefined);
            context = null;
            try { restoreSession(); } catch { /* An optional session API can reject changes. */ }
        },
    };
}
