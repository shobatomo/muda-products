"use client";

import { Environment, Html, Lightformer } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect } from "react";
import type { DialAudio } from "@/lib/dial-audio";
import { ModalDial } from "./ModalDial";
import styles from "./TouchModal.module.css";

function ResponsiveCamera() {
    const { camera, size } = useThree();
    useLayoutEffect(() => {
        const distance = Math.max(1, size.height / size.width);
        camera.position.set(0.25 * distance, 0.18 * distance, 0.25 * distance);
        camera.lookAt(0, 0.005, 0);
    }, [camera, size.width, size.height]);
    return null;
}

export default function DialViewer({ audio }: { audio: DialAudio | null }) {
    return <div className={styles.viewer} tabIndex={0} role="group" aria-label="DIAL の3D操作" aria-describedby="dial-controls" onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.currentTarget.querySelector("canvas")?.dispatchEvent(new CustomEvent("muda:dial-step", { detail: event.key === "ArrowRight" ? 1 : -1 }));
    }}>
        <p id="dial-controls" className={styles.sr}>横方向にドラッグ、または左右矢印キーでダイヤルを回します。Escape キーで閉じます。</p>
        <Canvas camera={{ position: [0.25, 0.18, 0.25], fov: 28, near: 0.001, far: 10 }} onCreated={({ camera }) => camera.lookAt(0, 0.005, 0)} dpr={[1, 1.5]} gl={{ toneMappingExposure: 0.65 }} style={{ touchAction: "none" }} fallback={<p role="alert">この環境では3Dを表示できません。</p>}>
            <color attach="background" args={["#ffffff"]} />
            <ResponsiveCamera />
            <directionalLight position={[-2, 4, 3]} intensity={10} />
            <directionalLight position={[7, 2, -2]} intensity={2} />
            <directionalLight position={[-5, 3, -5]} intensity={3} />
            <directionalLight position={[0, -3, -3]} intensity={0.8} />
            <Environment resolution={256} environmentIntensity={0.8}>
                <Lightformer position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[5, 5, 1]} intensity={3} />
                <Lightformer position={[-3, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[2, 5, 1]} intensity={2} />
                <Lightformer position={[2, 1, -3]} scale={[4, 2, 1]} intensity={2} />
            </Environment>
            <Suspense fallback={<Html center><p role="status" style={{ whiteSpace: "nowrap", fontSize: 12 }}>DIAL を読み込み中…</p></Html>}><ModalDial audio={audio} /></Suspense>
        </Canvas>
    </div>;
}
