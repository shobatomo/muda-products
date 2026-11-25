"use client";

import { Bounds, Center, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useId, useState, type CSSProperties } from "react";
import { Spherical, Vector3 } from "three";
import { MudaKey } from "@/components/three/MudaKey";
import { KEY_SWITCH_ORDER, KEY_SWITCHES, type KeySwitchId } from "@/lib/key-feel";
import styles from "./TouchModal.module.css";

function KeyboardCamera() {
    const { camera, gl, invalidate, controls } = useThree();
    useEffect(() => {
        function rotate(event: Event) {
            const key = (event as CustomEvent<string>).detail;
            const target = (controls as unknown as { target?: Vector3 })?.target ?? new Vector3();
            const spherical = new Spherical().setFromVector3(camera.position.clone().sub(target));
            if (key === "ArrowLeft") spherical.theta -= 0.15;
            if (key === "ArrowRight") spherical.theta += 0.15;
            if (key === "ArrowUp") spherical.phi -= 0.15;
            if (key === "ArrowDown") spherical.phi += 0.15;
            spherical.makeSafe();
            camera.position.copy(target).add(new Vector3().setFromSpherical(spherical));
            camera.lookAt(target);
            invalidate();
        }
        gl.domElement.addEventListener("muda:key-orbit", rotate);
        return () => gl.domElement.removeEventListener("muda:key-orbit", rotate);
    }, [camera, controls, gl, invalidate]);
    return null;
}

function press(element: HTMLElement, held: boolean) {
    element.querySelector("canvas")?.dispatchEvent(new CustomEvent("muda:key-press", { detail: held }));
}

export default function KeyViewer({ configurable = false }: { configurable?: boolean }) {
    const [axis, setAxis] = useState<KeySwitchId>("red");
    const selected = KEY_SWITCHES[axis];
    const controlsId = useId();
    return <div className={styles.keyExperience}>
        <div className={styles.viewer} tabIndex={0} role="group" aria-label={`KEY ${selected.label}モデルの3D操作`} aria-describedby={controlsId}
            onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    if (!event.repeat) press(event.currentTarget, true);
                } else if (event.key.startsWith("Arrow")) {
                    event.preventDefault();
                    event.currentTarget.querySelector("canvas")?.dispatchEvent(new CustomEvent("muda:key-orbit", { detail: event.key }));
                }
            }}
            onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") { event.preventDefault(); press(event.currentTarget, false); }
            }}
            onBlur={(event) => press(event.currentTarget, false)}>
            <p id={controlsId} className={styles.sr}>キーキャップを下へドラッグして押下、離すと戻ります。周囲をドラッグまたは矢印キーで回転。ホイール・モデルの周囲でのピンチで拡大縮小。Space・Enterを押している間も押下できます。音は未実装です。</p>
            <Canvas camera={{ position: [0.085, 0.07, 0.095], fov: 40, near: 0.001, far: 10 }} dpr={[1, 1.5]} frameloop="demand" style={{ touchAction: "none" }} fallback={<p role="alert">この環境では3Dを表示できません。</p>}>
                <color attach="background" args={["#ffffff"]} />
                <ambientLight intensity={0.9} />
                <directionalLight position={[2, 4, 3]} intensity={2.5} />
                <directionalLight position={[-3, 1, -2]} intensity={1.2} />
                <OrbitControls makeDefault enablePan={false} minDistance={0.06} maxDistance={0.5} />
                <KeyboardCamera />
                <Suspense fallback={<Html center><p role="status">KEY を読み込み中…</p></Html>}>
                    <Bounds fit clip observe margin={1.8} maxDuration={0}><Center><MudaKey axis={axis} /></Center></Bounds>
                </Suspense>
            </Canvas>
            <p className={configurable ? styles.status + " " + styles.keyStatus : styles.status}>キーキャップを下へドラッグ · 離すと戻る<br />周囲のドラッグで回転 · v1.1 モデル / 音は未実装</p>
        </div>
        {configurable && <div className={styles.switchPanel}>
            <p className={styles.switchHeading}>スイッチの軸</p>
            <div className={styles.switchOptions} role="group" aria-label="軸を選択">
                {KEY_SWITCH_ORDER.map((id) => {
                    const option = KEY_SWITCHES[id];
                    return <button key={id} type="button" aria-pressed={id === axis}
                        className={styles.switchOption}
                        style={{ "--axis-color": option.color } as CSSProperties}
                        onClick={() => setAxis(id)}>
                        <span className={styles.switchDot} aria-hidden="true" />
                        {option.label}
                    </button>;
                })}
            </div>
            <p className={styles.switchDescription} aria-live="polite"><strong>{selected.kind}</strong>：{selected.description}</p>
        </div>}
    </div>;
}
