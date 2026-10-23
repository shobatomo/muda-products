"use client";

import { Bounds, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { Spherical, Vector3 } from "three";
import { MudaKey } from "@/components/three/MudaKey";
import styles from "./TouchModal.module.css";

function KeyboardCamera() {
    const { camera, gl, invalidate, controls } = useThree();
    useEffect(() => {
        function rotate(event: Event) {
            const key = (event as CustomEvent<string>).detail;
            const target = (controls as unknown as { target?: Vector3 })?.target ?? new Vector3();
            const offset = camera.position.clone().sub(target);
            const spherical = new Spherical().setFromVector3(offset);
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

export default function KeyViewer() {
    return <div className={styles.viewer} tabIndex={0} role="group" aria-label="KEY 制作中モデルの3D形状確認" aria-describedby="key-modal-controls" onKeyDown={(event) => {
        if (!event.key.startsWith("Arrow")) return;
        event.preventDefault();
        event.currentTarget.querySelector("canvas")?.dispatchEvent(new CustomEvent("muda:key-orbit", { detail: event.key }));
    }}>
        <p id="key-modal-controls" className={styles.sr}>ドラッグまたは矢印キーで視点を回転。ホイール・ピンチで拡大縮小。押下・音・素材切替は未実装です。Escape キーで閉じます。</p>
        <Canvas camera={{ position: [0.12, 0.1, 0.12], fov: 40, near: 0.001, far: 10 }} dpr={[1, 1.5]} frameloop="demand" style={{ touchAction: "none" }} fallback={<p role="alert">この環境では3Dを表示できません。</p>}>
            <color attach="background" args={["#ffffff"]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[2, 4, 3]} intensity={2.5} />
            <directionalLight position={[-3, 1, -2]} intensity={0.8} />
            <OrbitControls makeDefault enablePan={false} minDistance={0.035} maxDistance={0.5} />
            <KeyboardCamera />
            <Suspense fallback={<Html center><p role="status">KEY を読み込み中…</p></Html>}>
                <Bounds fit clip observe margin={1.5} maxDuration={0}><MudaKey /></Bounds>
            </Suspense>
        </Canvas>
        <p className={styles.status}>制作中 · 形状確認のみ</p>
    </div>;
}
