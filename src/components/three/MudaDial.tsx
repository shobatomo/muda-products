import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";

// 操作感に関わる値をまとめ、フレームごとの計算から分離する。
const ROTATION_SENSITIVITY = 0.0028;
const FRICTION = 15;
const ROTATION_DAMPING = 12;
const RATCHET_STEP = Math.PI / 60;
const RATCHET_SHARPNESS = 15;
const DIAL_BASE_POSITION = { x: 0, y: 0.01, z: 0 };
const VIBRATION_DAMPING = 25;
const VIBRATION_SPEED = 90;
const HINT_DELAY = 5000;
const INITIAL_HINT_DELAYS = [750, 5000];
const HINT_DURATION = 1.2;
const HINT_ROTATION = THREE.MathUtils.degToRad(3);
const OUTLINE_LAYERS = [
    { scale: 1.02, opacity: 0.25 },
    { scale: 1.029, opacity: 0.18 },
    { scale: 1.036, opacity: 0.1 },
    { scale: 1.045, opacity: 0.06 },
];

type OutlineLayer = {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    baseOpacity: number;
};

function disposeOutlineLayers(layers: OutlineLayer[]) {
    layers.forEach(({ mesh, material }) => {
        mesh.removeFromParent();
        material.dispose();
    });
}

/** 歯の中央付近を速く、両端を遅くしてラチェットの引っ掛かりを再現する。 */
function applyRatchet(angle: number) {
    const stepIndex = Math.floor(angle / RATCHET_STEP);
    const stepStart = stepIndex * RATCHET_STEP;
    const progress = (angle - stepStart) / RATCHET_STEP;
    const eased =
        progress < 0.5
            ? 0.5 * (progress * 2) ** RATCHET_SHARPNESS
            : 1 - 0.5 * ((1 - progress) * 2) ** RATCHET_SHARPNESS;

    return stepStart + eased * RATCHET_STEP;
}

export function MudaDial() {
    const { scene } = useGLTF("/models/muda-dial-optimized.glb");
    const canvas = useThree((state) => state.gl.domElement);

    // 3Dオブジェクト
    const dialGroupRef = useRef<THREE.Group>(null);
    const dialRef = useRef<THREE.Object3D | null>(null);
    const outlineLayersRef = useRef<OutlineLayer[]>([]);

    // ポインター操作
    const activePointerIdRef = useRef<number | null>(null);
    const previousPointerXRef = useRef(0);
    const lastMoveTimeRef = useRef(0);
    const isDraggingRef = useRef(false);

    // 回転状態
    const targetRotationRef = useRef(0);
    const velocityRef = useRef(0);
    const lastRatchetIndexRef = useRef(0);
    const clickSoundRef = useRef<HTMLAudioElement | null>(null);
    const hasPendingClickSoundRef = useRef(false);
    const vibrationRef = useRef(0);
    const displayRotationRef = useRef(0);
    const hasInteractedRef = useRef(false);
    const idleHintPlayedRef = useRef(false);
    const initialHintIndexRef = useRef(0);
    const initialHintStartedAtRef = useRef<number | null>(null);

    // 操作がないときに、短い自動回転でドラッグ可能なことを伝える。
    const lastInteractionRef = useRef(0);
    const hintActiveRef = useRef(false);
    const hintTimeRef = useRef(0);

    // 再生が許可されるまでは未再生状態を保持し、次のユーザー操作で再試行する
    const playClickSound = useCallback(() => {
        const sound = clickSoundRef.current;

        if (!sound) {
            return;
        }

        hasPendingClickSoundRef.current = true;
        sound.currentTime = 0;

        void sound
            .play()
            .then(() => {
                hasPendingClickSoundRef.current = false;
            })
            .catch((error: unknown) => {
                if (
                    error instanceof DOMException &&
                    (error.name === "NotAllowedError" ||
                        error.name === "AbortError")
                ) {
                    return;
                }

                console.warn("ラチェット音を再生できませんでした。", error);
            });
    }, []);

    // ポインターが押されたときにドラッグを開始する
    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        if (event.button !== 0 || activePointerIdRef.current !== null) {
            return;
        }

        const now = performance.now();

        event.stopPropagation();
        activePointerIdRef.current = event.pointerId;
        previousPointerXRef.current = event.clientX;
        lastMoveTimeRef.current = now;
        isDraggingRef.current = true;
        lastInteractionRef.current = now;
        hasInteractedRef.current = true;
        idleHintPlayedRef.current = false;
        initialHintIndexRef.current = INITIAL_HINT_DELAYS.length;
        hintActiveRef.current = false;
        hintTimeRef.current = 0;
        outlineLayersRef.current.forEach(({ material }) => {
            material.opacity = 0;
        });

        // Canvas外へドラッグしてもポインターイベントを受け取る
        canvas.setPointerCapture(event.pointerId);
    };

    // Audio 要素は再レンダー不要のため Ref で保持し、破棄時に再生を止める。
    useEffect(() => {
        const sound = new Audio("/sounds/ratchet_sound.WAV");
        sound.preload = "auto";
        sound.volume = 0.3;
        clickSoundRef.current = sound;
        sound.load();

        return () => {
            sound.pause();
            clickSoundRef.current = null;
            hasPendingClickSoundRef.current = false;
        };
    }, []);

    // モデル内の操作対象とマテリアルを初期化する
    useEffect(() => {
        const initializedAt = performance.now();

        lastInteractionRef.current = initializedAt;
        initialHintStartedAtRef.current = initializedAt;
        const dial = scene.getObjectByName("CTRL_Upper") ?? null;
        const outerMesh = scene.getObjectByName("BodyShell");
        const createdOutlineLayers: OutlineLayer[] = [];

        // Fast RefreshなどでEffectが再実行された場合も、前回の生成物を残さない。
        disposeOutlineLayers(outlineLayersRef.current);
        outlineLayersRef.current = [];

        if (!(outerMesh instanceof THREE.Mesh)) {
            console.warn("ダイヤル外周のMeshが見つかりませんでした");
        }

        if (outerMesh instanceof THREE.Mesh) {
            OUTLINE_LAYERS.forEach(({ scale, opacity: baseOpacity }) => {
                const material = new THREE.MeshBasicMaterial({
                    color: 0xaaff00,
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                    toneMapped: false,
                });

                const outline = new THREE.Mesh(outerMesh.geometry, material);

                outline.position.copy(outerMesh.position);
                outline.rotation.copy(outerMesh.rotation);
                outline.scale.copy(outerMesh.scale);

                outline.scale.multiplyScalar(scale);

                outerMesh.parent?.add(outline);

                createdOutlineLayers.push({
                    mesh: outline,
                    material,
                    baseOpacity,
                });
            });
        }

        outlineLayersRef.current = createdOutlineLayers;

        // dial?.traverse((child) => {
        //     if (child instanceof THREE.Mesh) {
        //         const materials = Array.isArray(child.material)
        //             ? child.material
        //             : [child.material];

        //         console.log({
        //             mesh: child.name,
        //             materials: materials.map((material) => material.name),
        //         });
        //     }
        // });

        dialRef.current = dial;

        if (dial) {
            targetRotationRef.current = dial.rotation.y;
            displayRotationRef.current = dial.rotation.y;
        } else {
            console.warn(
                "CTRL_Upperが見つかりません。ダイヤルを回転できません。",
            );
        }

        scene.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) {
                return;
            }

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];
            const centerPlateMaterial = materials.find(
                (material) =>
                    material.name === "MAT_CenterPlate_Titanium" &&
                    material instanceof THREE.MeshStandardMaterial,
            );

            if (!centerPlateMaterial) {
                return;
            }

            // 中央プレートだけ金属の異方性を強め、加工されたチタンの質感にする。
            centerPlateMaterial.metalness = 1;
            centerPlateMaterial.roughness = 0.3;
            centerPlateMaterial.anisotropy = 1;
            centerPlateMaterial.anisotropyRotation = 0;
        });

        return function clearDialReference() {
            disposeOutlineLayers(createdOutlineLayers);

            if (outlineLayersRef.current === createdOutlineLayers) {
                outlineLayersRef.current = [];
            }

            dialRef.current = null;
        };
    }, [scene]);

    // Canvas外で発生するドラッグイベントを監視する
    useEffect(() => {
        const finishDragging = (pointerId: number) => {
            if (activePointerIdRef.current !== pointerId) {
                return false;
            }

            activePointerIdRef.current = null;
            isDraggingRef.current = false;

            if (canvas.hasPointerCapture(pointerId)) {
                canvas.releasePointerCapture(pointerId);
            }

            return true;
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (activePointerIdRef.current !== event.pointerId) {
                return;
            }

            // pointerupを取りこぼした場合でも、ボタンが離れていれば終了する
            if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
                finishDragging(event.pointerId);
                return;
            }

            const deltaX = event.clientX - previousPointerXRef.current;
            const rotationDelta = deltaX * ROTATION_SENSITIVITY;
            const now = performance.now();
            const deltaTime = (now - lastMoveTimeRef.current) / 1000;

            lastInteractionRef.current = now;

            targetRotationRef.current += rotationDelta;

            previousPointerXRef.current = event.clientX;

            if (deltaTime > 0) {
                velocityRef.current = rotationDelta / deltaTime;
            }

            lastMoveTimeRef.current = now;
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (finishDragging(event.pointerId)) {
                // タッチ操作はpointerupでユーザー操作として確定するため、
                // 初回ドラッグ中にブロックされた音をこの同期処理内で再試行する
                if (hasPendingClickSoundRef.current) {
                    playClickSound();
                }

                lastInteractionRef.current = performance.now();
            }
        };

        const handlePointerCancel = (event: PointerEvent) => {
            finishDragging(event.pointerId);
        };

        const handleWindowBlur = () => {
            const pointerId = activePointerIdRef.current;

            if (pointerId !== null) {
                finishDragging(pointerId);
            }
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
            window.removeEventListener("blur", handleWindowBlur);

            const pointerId = activePointerIdRef.current;

            if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
                canvas.releasePointerCapture(pointerId);
            }

            activePointerIdRef.current = null;
            isDraggingRef.current = false;
        };
    }, [canvas, playClickSound]);

    // 慣性、ラチェット、操作ヒント、振動を毎フレーム合成して表示へ反映する。
    useFrame(({ clock }, delta) => {
        const dial = dialRef.current;

        if (!dial) {
            return;
        }

        // ドラッグ終了後は速度を減衰させながら慣性回転させる。
        if (!isDraggingRef.current) {
            targetRotationRef.current += velocityRef.current * delta;

            velocityRef.current = THREE.MathUtils.damp(
                velocityRef.current,
                0,
                FRICTION,
                delta,
            );
        }

        const ratchetTarget = applyRatchet(targetRotationRef.current);

        const ratchetIndex = Math.round(
            targetRotationRef.current / RATCHET_STEP,
        );

        // 歯をまたいだ瞬間だけクリック音と小さな振動を発生させる。
        if (ratchetIndex !== lastRatchetIndexRef.current) {
            lastRatchetIndexRef.current = ratchetIndex;
            playClickSound();
            vibrationRef.current = 0.00015;
        }

        const now = performance.now();
        const initialHintStartedAt = initialHintStartedAtRef.current;
        const isInitialHintDue =
            !hasInteractedRef.current &&
            !hintActiveRef.current &&
            initialHintStartedAt !== null &&
            initialHintIndexRef.current < INITIAL_HINT_DELAYS.length &&
            now - initialHintStartedAt >=
                INITIAL_HINT_DELAYS[initialHintIndexRef.current];
        const isIdleHintDue =
            !isDraggingRef.current &&
            !hintActiveRef.current &&
            hasInteractedRef.current &&
            now - lastInteractionRef.current > HINT_DELAY &&
            !idleHintPlayedRef.current;

        if (isInitialHintDue || isIdleHintDue) {
            hintActiveRef.current = true;
            hintTimeRef.current = 0;

            if (isIdleHintDue) {
                idleHintPlayedRef.current = true;
            } else {
                initialHintIndexRef.current += 1;
            }
        }

        let hintRotation = 0;

        if (hintActiveRef.current) {
            hintTimeRef.current += delta;

            const progress = Math.min(hintTimeRef.current / HINT_DURATION, 1);
            const wave = Math.sin(progress * Math.PI * 2);
            const envelope = Math.sin(progress * Math.PI);

            hintRotation = wave * envelope * HINT_ROTATION;

            // アウトライン発光処理
            outlineLayersRef.current.forEach(({ material, baseOpacity }) => {
                material.opacity = baseOpacity * envelope;
            });

            if (progress >= 1) {
                hintActiveRef.current = false;
                hintTimeRef.current = 0;
                hintRotation = 0;

                outlineLayersRef.current.forEach(({ material }) => {
                    material.opacity = 0;
                });
            }
        }

        displayRotationRef.current = THREE.MathUtils.damp(
            displayRotationRef.current,
            ratchetTarget,
            ROTATION_DAMPING,
            delta,
        );

        dial.rotation.y = displayRotationRef.current + hintRotation;

        const dialGroup = dialGroupRef.current;
        const vibration = vibrationRef.current;

        if (dialGroup) {
            const phase = clock.elapsedTime * VIBRATION_SPEED;

            dialGroup.position.set(
                DIAL_BASE_POSITION.x + Math.sin(phase) * vibration,
                DIAL_BASE_POSITION.y + Math.cos(phase * 1.17) * vibration,
                DIAL_BASE_POSITION.z + Math.sin(phase * 0.83) * vibration * 0.5,
            );
        }

        vibrationRef.current = THREE.MathUtils.damp(
            vibration,
            0,
            VIBRATION_DAMPING,
            delta,
        );
    });

    return (
        <group
            ref={dialGroupRef}
            position={[
                DIAL_BASE_POSITION.x,
                DIAL_BASE_POSITION.y,
                DIAL_BASE_POSITION.z,
            ]}
            onPointerDown={handlePointerDown}
        >
            <primitive object={scene} />
        </group>
    );
}

useGLTF.preload("/models/muda-dial-optimized.glb");
