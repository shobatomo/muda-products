"use client";

import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import type { Mesh } from "three";
import { MudaDial } from "./three/MudaDial";

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
                position: [
                    isDesktop ? 0.165 : 0.25,
                    isDesktop ? 0.33 : 0.18,
                    isDesktop ? 0.165 : 0.25,
                ],
                fov: 28,
            }}
            dpr={[1, 1.5]}
            gl={{
                toneMappingExposure: 0.4,
            }}
        >
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

            {isDesktop && (
                <OrbitControls
                    enablePan={false}
                    enableZoom={false}
                    minPolarAngle={Math.PI / 3}
                    maxPolarAngle={(Math.PI * 2) / 3}
                />
            )}
        </Canvas>
    );
}

// ------------------------------------------
// テスト用にキューブを表示していたコンポーネント
// ------------------------------------------
// function ProductCube() {
//     const cubeRef = useRef<Mesh>(null);

//     useFrame((_, delta) => {
//         if (!cubeRef.current) {
//             return;
//         }

//         cubeRef.current.rotation.y += delta * 0.25;
//     });

//     return (
//         <mesh ref={cubeRef} rotation={[0.25, 0.45, 0]}>
//             <boxGeometry args={[2, 2, 2]} />

//             <meshStandardMaterial
//                 color="#242424"
//                 metalness={0.65}
//                 roughness={0.28}
//             />
//         </mesh>
//     );
// }

// Dialを表示するための関数
// Dial用のコンポーネントを別で作成したので不要
// function ProductModel() {
//     const { scene } = useGLTF("/models/muda-dial-optimized.glb");
//     return <primitive object={scene} position={[0, 0, 0]} scale={[1, 1, 1]} />;
// }
