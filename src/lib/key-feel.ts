/** Visual response for RED. Screen motion is not physical force feedback. */
export const RED_KEY_FEEL = {
    // Preserve the existing v1.1 visual stroke in all modes.
    // 沈み込みの幅
    travel: 0.0105,
    // 抵抗をなしに
    pressDamping: 100,
    // 戻る強さ
    returnDamping: 100,
    // 最初の沈み込みの深さ
    initialDepth: 0,
    // ドラッグ距離の割合　押し心地に関わる
    dragFraction: 1.5,
    // 
    minDragPixels: 32,
    maxDragPixels: 64,
} as const;

type KeyMotion = { [K in keyof typeof RED_KEY_FEEL]: number };
type KeyResponse = { type: "linear" }
    | { type: "click"; pressPoint: number; resetPoint: number; snapDepth: number }
    | { type: "bump"; bumpStart: number; bumpEnd: number; bumpDepth: number };

export const KEY_SWITCHES = {
    red: {
        label: "赤軸", kind: "リニア", color: "#C84752",
        description: "途中に段差がなく、指に合わせてすっと沈む。",
        motion: RED_KEY_FEEL,
        response: { type: "linear" },
    },
    blue: {
        label: "青軸", kind: "クリッキー", color: "#356ABE",
        description: "途中まで踏ん張り、しきい値を越えるとカチッと一段沈む。",
        motion: { travel: 0.0105, pressDamping: 100, returnDamping: 100, initialDepth: 0, dragFraction: 1.5, minDragPixels: 32, maxDragPixels: 64 },
        response: { type: "click", pressPoint: 0.53, resetPoint: 0.36, snapDepth: 0.19 },
    },
    brown: {
        label: "茶軸", kind: "タクタイル", color: "#936547",
        description: "途中で一度引っかかり、乗り越えると滑らかに沈む。",
        motion: { travel: 0.0105, pressDamping: 100, returnDamping: 100, initialDepth: 0, dragFraction: 1.5, minDragPixels: 32, maxDragPixels: 64 },
        response: { type: "bump", bumpStart: 0.2, bumpEnd: 0.88, bumpDepth: 0.088 },
    },
} satisfies Record<string, { label: string; kind: string; color: string; description: string; motion: KeyMotion; response: KeyResponse }>;

export type KeySwitchId = keyof typeof KEY_SWITCHES;
export const KEY_SWITCH_ORDER = ["red", "blue", "brown"] as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function keyDragInput(settings: KeyMotion, deltaY: number, viewportSize: number) {
    const distance = Math.min(settings.maxDragPixels, Math.max(settings.minDragPixels, viewportSize * settings.dragFraction));
    return clamp01(settings.initialDepth + deltaY / distance);
}

export function redKeyDepth(deltaY: number, viewportSize: number) {
    return keyDragInput(RED_KEY_FEEL, deltaY, viewportSize);
}

/** Motion cues on a shared model, not a physical force simulation. */
export function mapKeySwitchDepth(axis: KeySwitchId, input: number, wasLatched: boolean) {
    const t = clamp01(input);
    const response = KEY_SWITCHES[axis].response;
    if (response.type === "linear") return { depth: t, latched: false };
    if (response.type === "bump") {
        const width = Math.max(0.001, response.bumpEnd - response.bumpStart);
        const progress = clamp01((t - response.bumpStart) / width);
        // Limit amplitude so the key never travels in reverse while pressing.
        const amplitude = Math.max(0, Math.min(response.bumpDepth, width * 0.30));
        return { depth: clamp01(t - amplitude * Math.sin(Math.PI * progress) ** 2), latched: false };
    }
    const pressPoint = Math.max(0.001, clamp01(response.pressPoint));
    const resetPoint = Math.min(pressPoint - 0.001, clamp01(response.resetPoint));
    const latched = wasLatched ? t > resetPoint : t >= pressPoint;
    const snapDepth = clamp01(response.snapDepth);
    return { depth: t * (1 - snapDepth) + (latched ? snapDepth : 0), latched };
}
