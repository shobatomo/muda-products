"use client";

import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

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
function ProductModel() {
    const { scene } = useGLTF("/models/muda-dial-2k.glb");
    return <primitive object={scene} position={[0, 0, 0]} scale={[1, 1, 1]} />;
}

export function ProductScene() {
    return (
        <Canvas
            camera={{
                position: [0.2, 0.4, 0.2],
                fov: 28,
            }}
            dpr={[1, 2]}
        >
            <ambientLight intensity={1.2} />

            {/* Key Light */}
            <directionalLight position={[-2, 1, 1]} intensity={10} />

            {/* Fill Light */}
            <directionalLight position={[7, 2, -2]} intensity={2} />

            {/* Rim Light */}
            <directionalLight position={[-5, 3, -5]} intensity={3} />

            <ProductModel />

            {/* HDRIを追加 background={false}で背景を削除　反射のみを反映 */}
            <Environment preset="studio" background={false} />

            <OrbitControls
                enablePan={false}
                enableZoom={true}
                minPolarAngle={Math.PI / 3}
                maxPolarAngle={(Math.PI * 2) / 3}
            />
        </Canvas>
    );
}
