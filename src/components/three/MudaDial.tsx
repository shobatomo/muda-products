"use client";

import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";

// Dialを表示するための関数
export function MudaDial() {
    const { scene } = useGLTF("/models/muda-dial-optimized.glb");

    useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // 中心のチタンの質感を個別に設定
                if (
                    child instanceof THREE.Mesh &&
                    child.material.name === "MAT_CenterPlate_Titanium"
                ) {
                    child.material.metalness = 1;
                    child.material.roughness = 0.3;
                    child.material.anisotropy = 1;
                    child.material.anisotropyRotation = 0;
                }

                // それぞれの情報をコンソールに出力：確認用
                // const materials = Array.isArray(child.material)
                //     ? child.material
                //     : [child.material];

                // materials.forEach((material) => {
                //     console.log({
                //         mesh: child.name,
                //         material: material.name,
                //         type: material.type,
                //         roughness: material.roughness,
                //         metalness: material.metalness,
                //         roughnessMap: material.roughnessMap,
                //         normalMap: material.normalMap,
                //         anisotropy: material.anisotropy,
                //         anisotropyMap: material.anisotropyMap,
                //         anisotropyRotation: material.anisotropyRotation,
                //     });
                // });
            }
        });
    }, [scene]);

    return (
        <primitive object={scene} position={[0, 0.01, 0]} scale={[1, 1, 1]} />
    );
}

useGLTF.preload("/models/muda-dial-optimized.glb");
