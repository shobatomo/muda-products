"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useEffect, useState } from "react";
import { MudaDial } from "./three/MudaDial";

// カメラの設定を定義しておく
const DESKTOP_CAMERA_POSITION: [number, number, number] = [0.25, 0.18, 0.25];
const MOBILE_CAMERA_POSITION: [number, number, number] = [0.25, 0.18, 0.25];
const CAMERA_TARGET: [number, number, number] = [0, 0, 0];

// カメラを管理するためのコンポーネント
type CameraSetupProps = {
    isDesktop: boolean;
};

function CameraSetup({ isDesktop }: CameraSetupProps) {
    const camera = useThree((state) => state.camera);

    useLayoutEffect(() => {
        const position = isDesktop
            ? DESKTOP_CAMERA_POSITION
            : MOBILE_CAMERA_POSITION;

        camera.position.set(position[0], position[1], position[2]);

        camera.lookAt(CAMERA_TARGET[0], CAMERA_TARGET[1], CAMERA_TARGET[2]);
    }, [camera, isDesktop]);

    return null;
}

//デスクトップかどうかを判別する
function useIsDesktop() {
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        // 画面幅が768px以上かどうかを判定するメディアクエリを作成
        const mediaQuery = window.matchMedia("(min-width: 768px)");

        // メディアクエリが変更されたかどうかを監視する
        const update = () => setIsDesktop(mediaQuery.matches);

        update();

        // イベントリスナーで変更があればupdateを実行する
        mediaQuery.addEventListener("change", update);

        return () => {
            mediaQuery.removeEventListener("change", update);
        };
    }, []);

    // デスクトップかどうかを返す
    return isDesktop;
}

export function ProductScene() {
    const isDesktop = useIsDesktop();

    return (
        <Canvas
            camera={{
                fov: 28,
            }}
            dpr={[1, 1.5]}
            style={{ touchAction: "none" }}
            gl={{
                toneMappingExposure: 0.4,
            }}
        >
            <CameraSetup isDesktop={isDesktop} />

            {/* HDRIがあるので不要 */}
            {/* <ambientLight intensity={1} /> */}

            {/* Key Light */}
            <directionalLight position={[-2, 4, 3]} intensity={10} />

            {/* Fill Light */}
            <directionalLight position={[7, 2, -2]} intensity={2} />

            {/* Rim Light */}
            <directionalLight position={[-5, 3, -5]} intensity={3} />

            {/* Rim Light2 */}
            <directionalLight position={[0, -3, -3]} intensity={0.8} />

            <MudaDial />

            {/* HDRIを追加 background={false}で背景を削除　反射のみを反映 */}
            <Environment
                preset="studio"
                background={false}
                environmentIntensity={0.8}
            />

            {/* {isDesktop && (
                <OrbitControls
                    target={CAMERA_TARGET}
                    enablePan={false}
                    enableZoom={false}
                    minPolarAngle={Math.PI / 3}
                    maxPolarAngle={(Math.PI * 2) / 3}
                />
            )} */}
        </Canvas>
    );
}
