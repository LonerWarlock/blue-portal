"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Original procedural artwork inspired by Blue's own ribbon mark. No model,
// texture, mascot or geometry is borrowed from another company's website.
class BlueRibbon extends THREE.Curve<THREE.Vector3> {
  constructor() { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2;
    return target.set(Math.sin(angle * 2) * 0.96, Math.sin(angle) * 1.48, Math.cos(angle) * 0.5);
  }
}

export default function BlueCoreScene({ dark, onReady, onUnavailable }: {
  dark: boolean; onReady: () => void; onUnavailable: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { onUnavailable(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 768 ? 1 : 1.4));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.3 : 1.05;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 0, 6.5);
    const shape = new THREE.Shape();
    const w = 0.245, h = 0.038, r = 0.026;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h); shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r); shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h); shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r); shape.quadraticCurveTo(-w, -h, -w + r, -h);
    const geometry = new THREE.ExtrudeGeometry(shape, { steps: 220, bevelEnabled: false, curveSegments: 5, extrudePath: new BlueRibbon() });
    const material = new THREE.MeshPhysicalMaterial({ color: dark ? "#328de5" : "#146fc4", metalness: 0.82, roughness: 0.23, clearcoat: 1, clearcoatRoughness: 0.2 });
    const ribbon = new THREE.Mesh(geometry, material);
    const group = new THREE.Group();
    group.add(ribbon); scene.add(group);
    group.rotation.set(0.12, -0.32, -0.18);
    scene.add(new THREE.HemisphereLight("#edf6ff", "#18314a", 2.4));
    const key = new THREE.DirectionalLight("#ffffff", 5.5); key.position.set(-3, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight("#a7d9ff", 5); rim.position.set(4, 1, -2); scene.add(rim);
    const fill = new THREE.DirectionalLight("#296dcb", 2); fill.position.set(-4, -2, 3); scene.add(fill);

    // A tiny locally-generated studio light map provides satin reflections.
    const studio = document.createElement("canvas"); studio.width = 256; studio.height = 128;
    const context = studio.getContext("2d");
    let env: THREE.CanvasTexture | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    if (context) {
      context.fillStyle = dark ? "#193652" : "#748faa"; context.fillRect(0, 0, 256, 128);
      const light = context.createLinearGradient(0, 0, 0, 128);
      light.addColorStop(0, "#edf7ff"); light.addColorStop(0.42, "#93b9d5"); light.addColorStop(0.53, "#21384e"); light.addColorStop(1, "#475e78");
      context.fillStyle = light; context.fillRect(0, 0, 256, 128);
      context.fillStyle = "#ffffff"; context.fillRect(36, 12, 20, 90); context.fillRect(155, 18, 9, 70);
      env = new THREE.CanvasTexture(studio); env.mapping = THREE.EquirectangularReflectionMapping;
      const generator = new THREE.PMREMGenerator(renderer);
      environment = generator.fromEquirectangular(env); scene.environment = environment.texture;
      generator.dispose();
    }

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false); camera.aspect = width / height;
      // The sculpture fits even in a narrow mobile viewport.
      camera.position.z = camera.aspect < 0.85 ? 7.5 : 6.5;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pointer = { x: 0, y: 0 };
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType !== "mouse") return;
      const bounds = host.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / bounds.width - 0.5;
      pointer.y = (event.clientY - bounds.top) / bounds.height - 0.5;
    };
    const leave = () => { pointer.x = 0; pointer.y = 0; };
    host.addEventListener("pointermove", move); host.addEventListener("pointerleave", leave);
    const lost = (event: Event) => { event.preventDefault(); onUnavailable(); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    let frame = 0, last = 0, first = true, disposed = false;
    const start = performance.now();
    const draw = (time: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(draw);
      if (document.hidden || time - last < 1000 / 30) return;
      last = time;
      const elapsed = (time - start) / 1000;
      group.rotation.y += ((-0.32 + Math.sin(elapsed * 0.24) * 0.3 + pointer.x * 0.45) - group.rotation.y) * 0.045;
      group.rotation.x += ((0.12 + pointer.y * 0.18) - group.rotation.x) * 0.045;
      group.position.y = Math.sin(elapsed * 0.7) * 0.055;
      try { renderer.render(scene, camera); }
      catch { cancelAnimationFrame(frame); disposed = true; onUnavailable(); return; }
      if (first) { first = false; onReady(); }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometry.dispose(); material.dispose(); environment?.dispose(); env?.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [dark, onReady, onUnavailable]);
  return <div ref={hostRef} className="blue-core-canvas" />;
}
