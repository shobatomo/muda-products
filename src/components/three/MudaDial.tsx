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
const HINT_DURATION = 1.2;
const HINT_ROTATION = THREE.MathUtils.degToRad(3);

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
    const initialHintPlayedRef = useRef(false);

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
        initialHintPlayedRef.current = true;
        hintActiveRef.current = false;
        hintTimeRef.current = 0;

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
        lastInteractionRef.current = performance.now();
        const dial = scene.getObjectByName("CTRL_Upper") ?? null;
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
        const isHintDue =
            !isDraggingRef.current &&
            !hintActiveRef.current &&
            now - lastInteractionRef.current > HINT_DELAY &&
            ((!hasInteractedRef.current && !initialHintPlayedRef.current) ||
                (hasInteractedRef.current && !idleHintPlayedRef.current));

        if (isHintDue) {
            hintActiveRef.current = true;
            hintTimeRef.current = 0;

            if (hasInteractedRef.current) {
                idleHintPlayedRef.current = true;
            } else {
                initialHintPlayedRef.current = true;
            }
        }

        let hintRotation = 0;

        if (hintActiveRef.current) {
            hintTimeRef.current += delta;

            const progress = Math.min(hintTimeRef.current / HINT_DURATION, 1);
            const wave = Math.sin(progress * Math.PI * 2);
            const envelope = Math.sin(progress * Math.PI);

            hintRotation = wave * envelope * HINT_ROTATION;

            if (progress >= 1) {
                hintActiveRef.current = false;
                hintTimeRef.current = 0;
                hintRotation = 0;
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
