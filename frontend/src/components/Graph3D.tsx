import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface FileResult {
  path: string;
  type: 'changed' | 'affected' | 'unaffected';
  status: 'changed' | 'direct_affected' | 'indirect_affected' | 'unaffected';
  riskScore: number;
  impactDepth: number;
  reasons: string[];
  prStatus?: string;
}

interface DependencyEdge {
  source: string;
  target: string;
  importPath: string;
}

interface Graph3DProps {
  files: FileResult[];
  dependencies: DependencyEdge[];
  selectedFile: FileResult | null;
  onSelectFile: (file: FileResult) => void;
}

export const Graph3D: React.FC<Graph3DProps> = ({
  files,
  dependencies,
  selectedFile,
  onSelectFile,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // References to keep across renders
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 300;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(0, 160, 380);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.replaceChildren(renderer.domElement);

    // 2. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    controls.maxDistance = 800;
    controls.minDistance = 80;
    controlsRef.current = controls;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xa78bfa, 2.5, 800);
    pointLight.position.set(0, 200, 100);
    scene.add(pointLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(-150, 100, 150);
    scene.add(dirLight);

    // Subtle 3D grid floor
    const grid = new THREE.GridHelper(500, 20, 0x334155, 0x1e293b);
    grid.position.y = -80;
    scene.add(grid);

    // 4. Calculate 3D Coordinates for each node
    // Place changed files at center, direct affected on middle ring, indirect on outer ring
    const nodePositions = new Map<string, THREE.Vector3>();

    const changedNodes = files.filter((f) => f.status === 'changed');
    const directNodes = files.filter((f) => f.status === 'direct_affected');
    const indirectNodes = files.filter((f) => f.status === 'indirect_affected');
    const safeNodes = files.filter((f) => f.status === 'unaffected');

    // Root changed nodes (Center)
    changedNodes.forEach((node, idx) => {
      const angle = (idx / Math.max(1, changedNodes.length)) * Math.PI * 2;
      const r = changedNodes.length > 1 ? 30 : 0;
      nodePositions.set(
        node.path,
        new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r)
      );
    });

    // Direct affected nodes (Radius ~120)
    directNodes.forEach((node, idx) => {
      const angle = (idx / Math.max(1, directNodes.length)) * Math.PI * 2;
      const r = 120;
      const y = Math.sin(idx) * 20;
      nodePositions.set(
        node.path,
        new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
      );
    });

    // Indirect affected nodes (Radius ~210)
    indirectNodes.forEach((node, idx) => {
      const angle = (idx / Math.max(1, indirectNodes.length)) * Math.PI * 2 + 0.5;
      const r = 210;
      const y = Math.cos(idx) * 35;
      nodePositions.set(
        node.path,
        new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
      );
    });

    // Unaffected safe nodes (Radius ~280)
    safeNodes.forEach((node, idx) => {
      const angle = (idx / Math.max(1, safeNodes.length)) * Math.PI * 2 + 1.0;
      const r = 280;
      const y = (idx % 2 === 0 ? 1 : -1) * 45;
      nodePositions.set(
        node.path,
        new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
      );
    });

    // Fallback for any unpositioned nodes
    files.forEach((node, idx) => {
      if (!nodePositions.has(node.path)) {
        nodePositions.set(node.path, new THREE.Vector3(idx * 40 - 100, 0, 0));
      }
    });

    // 5. Create 3D Meshes for Nodes
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const nodeMeshes: THREE.Mesh[] = [];

    files.forEach((file) => {
      const pos = nodePositions.get(file.path)!;
      let color = 0x475569;
      let emissive = 0x1e293b;
      let radius = 10;

      if (file.status === 'changed') {
        color = 0xf43f5e;
        emissive = 0x9f1239;
        radius = 16;
      } else if (file.status === 'direct_affected') {
        color = 0xf59e0b;
        emissive = 0x78350f;
        radius = 13;
      } else if (file.status === 'indirect_affected') {
        color = 0x818cf8;
        emissive = 0x312e81;
        radius = 11;
      }

      const isSelected = selectedFile?.path === file.path;

      const material = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffffff : color,
        emissive: isSelected ? 0xa855f7 : emissive,
        emissiveIntensity: isSelected ? 1.5 : 0.8,
        roughness: 0.25,
        metalness: 0.7,
      });

      const mesh = new THREE.Mesh(sphereGeometry, material);
      mesh.scale.set(radius, radius, radius);
      mesh.position.copy(pos);
      mesh.userData = { file };
      scene.add(mesh);
      nodeMeshes.push(mesh);

      // Add pulsing halo ring for changed root nodes
      if (file.status === 'changed') {
        const ringGeo = new THREE.TorusGeometry(22, 1, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos);
        scene.add(ring);
      }

      // 3D Text Label floating above node
      const label = createTextSprite(file.path.split('/').pop() || file.path, file.status);
      label.position.set(pos.x, pos.y + radius + 12, pos.z);
      scene.add(label);
    });

    // 6. Create 3D Dependency Links (Cylinders / Lines)
    dependencies.forEach((edge) => {
      const start = nodePositions.get(edge.source);
      const end = nodePositions.get(edge.target);
      if (!start || !end) return;

      const isEdgeActive =
        selectedFile &&
        (edge.source === selectedFile.path || edge.target === selectedFile.path);

      // Curved or straight 3D line
      const points = [start, end];
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
      const curveMat = new THREE.LineBasicMaterial({
        color: isEdgeActive ? 0xc084fc : 0x475569,
        linewidth: isEdgeActive ? 2 : 1,
        transparent: true,
        opacity: isEdgeActive ? 0.95 : 0.45,
      });

      const line = new THREE.Line(curveGeo, curveMat);
      scene.add(line);

      // Direction cone on line pointing towards target (imported file)
      const midPoint = new THREE.Vector3().lerpVectors(start, end, 0.65);
      const coneGeo = new THREE.ConeGeometry(3, 8, 12);
      const coneMat = new THREE.MeshBasicMaterial({
        color: isEdgeActive ? 0xc084fc : 0x64748b,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(midPoint);
      cone.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3().subVectors(end, start).normalize()
      );
      scene.add(cone);
    });

    // 7. Raycaster for clicking 3D nodes
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes, false);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0]?.object as THREE.Mesh;
        if (clickedMesh && clickedMesh.userData.file) {
          onSelectFile(clickedMesh.userData.file);
        }
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    // 8. Animation loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize observer
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.dispose();
      container.replaceChildren();
    };
  }, [files, dependencies, selectedFile, autoRotate]);

  // Toggle rotation
  const toggleRotate = () => {
    setAutoRotate((prev) => {
      const next = !prev;
      if (controlsRef.current) {
        controlsRef.current.autoRotate = next;
      }
      return next;
    });
  };

  // Reset camera view
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 160, 380);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '300px' }}>
      {/* 3D Canvas Mount Point */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '300px',
          background: 'radial-gradient(ellipse at center, #0f172a 0%, #070a13 100%)',
          borderRadius: '10px',
          overflow: 'hidden',
          cursor: 'grab',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      />

      {/* Floating 3D Scene Controls HUD */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '6px',
          zIndex: 10,
        }}
      >
        <button
          onClick={toggleRotate}
          title="Toggle 3D Orbit Auto-Rotation"
          style={{
            background: autoRotate ? 'rgba(99, 102, 241, 0.4)' : 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: autoRotate ? '#c7d2fe' : '#94a3b8',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          {autoRotate ? '⏸ Auto-Rotate' : '▶ Orbit'}
        </button>

        <button
          onClick={resetCamera}
          title="Reset 3D Camera View"
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#cbd5e1',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          ↺ Reset View
        </button>
      </div>

      {/* Bottom Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '12px',
          fontSize: '10px',
          color: '#64748b',
          pointerEvents: 'none',
        }}
      >
        Click & drag to rotate 3D graph · Scroll to zoom · Click node to inspect
      </div>
    </div>
  );
};

/**
 * Creates high-resolution 2D Canvas Sprite Text for 3D node labels
 */
function createTextSprite(text: string, status: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 64);

  // Background pill
  ctx.fillStyle =
    status === 'changed'
      ? 'rgba(136, 19, 55, 0.85)'
      : status === 'direct_affected'
      ? 'rgba(120, 53, 15, 0.85)'
      : status === 'indirect_affected'
      ? 'rgba(49, 46, 129, 0.85)'
      : 'rgba(30, 41, 59, 0.85)';

  ctx.strokeStyle =
    status === 'changed'
      ? '#f43f5e'
      : status === 'direct_affected'
      ? '#fbbf24'
      : status === 'indirect_affected'
      ? '#818cf8'
      : '#475569';
  ctx.lineWidth = 2;

  // Draw rounded rect
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(16 + r, 8);
  ctx.lineTo(240 - r, 8);
  ctx.quadraticCurveTo(240, 8, 240, 8 + r);
  ctx.lineTo(240, 56 - r);
  ctx.quadraticCurveTo(240, 56, 240 - r, 56);
  ctx.lineTo(16 + r, 56);
  ctx.quadraticCurveTo(16, 56, 16, 56 - r);
  ctx.lineTo(16, 8 + r);
  ctx.quadraticCurveTo(16, 8, 16 + r, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const display = text.length > 14 ? text.slice(0, 12) + '..' : text;
  ctx.fillText(display, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(36, 9, 1);

  return sprite;
}
