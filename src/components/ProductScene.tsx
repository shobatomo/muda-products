"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { MudaDial } from "./three/MudaDial";

const CAMERA_POSITION: [number, number, number] = [0.25, 0.18, 0.25];
const CAMERA_TARGET: [number, number, number] = [0, 0, 0];

// 斜め上から原点を見るように、Three.js のカメラを初期化する。
function CameraSetup() {
    const camera = useThree((state) => state.camera);

    useLayoutEffect(() => {
        camera.position.set(...CAMERA_POSITION);
        camera.lookAt(CAMERA_TARGET[0], CAMERA_TARGET[1], CAMERA_TARGET[2]);
    }, [camera]);

    return null;
}

export function ProductScene() {
    return (
        <Canvas
            camera={{
                fov: 28,
            }}
            dpr={1}
            style={{ touchAction: "pan-y" }}
            gl={{
                toneMappingExposure: 0.4,
            }}
        >
            <CameraSetup />

            {/* HDRI の反射に加え、方向の異なる照明で輪郭と陰影を補う。 */}
            <directionalLight position={[-2, 4, 3]} intensity={10} />
            <directionalLight position={[7, 2, -2]} intensity={2} />
            <directionalLight position={[-5, 3, -5]} intensity={3} />
            <directionalLight position={[0, -3, -3]} intensity={0.8} />

            <MudaDial />

            {/* 背景は描画せず、スタジオ HDRI の反射だけをモデルへ適用する。 */}
            <Environment
                preset="studio"
                background={false}
                environmentIntensity={0.8}
            />
        </Canvas>
    );
}
