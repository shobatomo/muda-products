/** Visual response for RED. Screen motion is not physical force feedback. */
export const RED_KEY_FEEL = {
    // The enlarged display model has been clearance-checked up to 10 mm.
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

/** Linear mapping: no tactile bump, snap point, or artificial over-travel. */
export function redKeyDepth(deltaY: number, viewportSize: number) {
    const distance = Math.min(RED_KEY_FEEL.maxDragPixels, Math.max(RED_KEY_FEEL.minDragPixels, viewportSize * RED_KEY_FEEL.dragFraction));
    return Math.min(1, Math.max(0, RED_KEY_FEEL.initialDepth + deltaY / distance));
}
