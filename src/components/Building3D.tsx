import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Edges,
  Html,
  OrbitControls,
  OrthographicCamera,
} from "@react-three/drei";
import { Layers } from "lucide-react";
import { Color, MathUtils, TOUCH, type Group, type MeshStandardMaterial } from "three";
import type { Room, RoomStatus, Settings } from "../types";
import { STATUS_META, formatVND, roomTotal } from "../utils/format";
import { cn } from "../utils/cn";
import { triggerHaptic } from "../utils/platformBridge";

/* ---------- Kích thước & bố cục (đơn vị 3D) ---------- */
const ROOM_W = 1.6; // chiều ngang phòng (trục X)
const ROOM_H = 1.1; // chiều cao khối
const ROOM_D = 2.0; // chiều sâu (trục Z)
const COL_STEP = 1.85; // khoảng cách giữa 2 phòng liền kề
const FLOOR_STEP = 1.5; // khoảng cách giữa 2 tầng

interface BlockProps {
  room: Room;
  centerCol: number;
  total: number;
  selected: boolean;
  hovered: boolean;
  flash: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  portalRef?: React.RefObject<HTMLDivElement | null>;
  showLabels?: boolean;
}

function RoomBlock({
  room,
  centerCol,
  total,
  selected,
  hovered,
  flash,
  dimmed,
  onHover,
  onSelect,
  portalRef,
  showLabels = true,
}: BlockProps) {
  const x = (room.col - centerCol) * COL_STEP;
  const y = (room.floor - 1) * FLOOR_STEP;

  const meta = STATUS_META[room.status];
  const groupRef = useRef<Group>(null);
  const matRef = useRef<MeshStandardMaterial>(null);
  const targetColor = useMemo(() => new Color(meta.hex), [meta.hex]);
  const lifted = selected || hovered;

  useFrame((state, delta) => {
    const g = groupRef.current;
    const m = matRef.current;
    if (g) {
      // Hover/chọn → nâng khối lên nhẹ; "flash" → nhịp đập khi vừa thanh toán
      const bump = flash ? Math.sin(state.clock.elapsedTime * 14) * 0.08 : 0;
      const goal = y + (lifted ? 0.28 : 0) + bump;
      g.position.y = MathUtils.damp(g.position.y, goal, 10, delta);
    }
    if (m) {
      m.color.lerp(targetColor, 1 - Math.exp(-8 * delta));
      m.opacity = MathUtils.damp(m.opacity, dimmed ? 0.2 : 1, 10, delta);
      m.transparent = dimmed || m.opacity < 0.99;
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <group ref={groupRef} position-y={y}>
        <mesh
          position={[0, ROOM_H / 2, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(room.id);
            if (typeof document !== "undefined") document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            onHover(null);
            if (typeof document !== "undefined") document.body.style.cursor = "auto";
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(room.id);
          }}
        >
          <boxGeometry args={[ROOM_W, ROOM_H, ROOM_D]} />
          <meshStandardMaterial
            ref={matRef}
            color={meta.hex}
            roughness={0.45}
            metalness={0.05}
            emissive={meta.hex}
            emissiveIntensity={selected ? 0.35 : hovered ? 0.2 : flash ? 0.5 : 0.02}
          />
          <Edges
            color={selected ? "#0f172a" : dimmed ? "#cbd5e1" : "#334155"}
            threshold={15}
            lineWidth={selected ? 2.5 : 1.2}
          />
        </mesh>

        {/* Nhãn phòng dạng 3D HTML Badge */}
        {showLabels && (
          <Html
            position={[0, ROOM_H * 0.55, ROOM_D / 2 + 0.02]}
            center
            transform
            sprite
            portal={portalRef as any}
            zIndexRange={[5, 0]}
            className="r3f-html pointer-events-auto"
            wrapperClass="r3f-html"
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelect(room.id);
              }}
              style={{ zIndex: 5 }}
              className={cn(
                "select-none rounded-xl px-2.5 py-1 text-center font-bold tracking-tight shadow-md transition-all z-[5]",
                selected
                  ? "scale-110 bg-slate-900 text-white ring-2 ring-white"
                  : "bg-white/95 text-slate-800 hover:scale-105",
                dimmed && "opacity-40"
              )}
            >
              <p className="text-[11px] leading-tight font-black">{room.id}</p>
              <p className="text-[9px] font-semibold text-rose-600 tabular-nums">
                {room.status === "EMPTY" ? "Trống" : formatVND(total)}
              </p>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

interface SceneProps {
  rooms: Room[];
  settings: Settings;
  selectedId: string | null;
  flashId: string | null;
  selectedFloor: number;
  filterStatus: RoomStatus | null;
  onSelect: (id: string) => void;
  isMobile?: boolean;
  portalRef?: React.RefObject<HTMLDivElement | null>;
  showLabels?: boolean;
}

function BuildingScene({
  rooms,
  settings,
  selectedId,
  flashId,
  selectedFloor,
  filterStatus,
  onSelect,
  isMobile = false,
  portalRef,
  showLabels = true,
}: SceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Tính số cột lớn nhất để căn giữa tòa nhà
  const { maxCol, centerCol } = useMemo(() => {
    const cols = rooms.map((r) => r.col);
    const m = cols.length > 0 ? Math.max(...cols) : 4;
    return { maxCol: m, centerCol: (m - 1) / 2 };
  }, [rooms]);

  const slabW = (maxCol + 1) * COL_STEP;

  const availableFloors = useMemo(() => {
    const list = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
    return list.length > 0 ? list : [1, 2, 3];
  }, [rooms]);

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 15, 8]} intensity={1.1} castShadow={!isMobile} />
      <directionalLight position={[-8, 10, -6]} intensity={0.4} />

      <group position={[0, 0, 0]}>
        {/* Mặt đế tòa nhà */}
        <mesh position={[0, -0.15, 0]}>
          <boxGeometry args={[slabW + 1.2, 0.25, 4.0]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
          <Edges color="#cbd5e1" />
        </mesh>

        {/* Các tấm sàn ngăn giữa các tầng */}
        {availableFloors.slice(0, -1).map((f) => {
          const slabY = (f - 1) * FLOOR_STEP + 1.25;
          const isVisible =
            selectedFloor === 0 || selectedFloor === f || selectedFloor === f + 1;
          return (
            <mesh key={`slab-${f}`} position={[0, slabY, 0]}>
              <boxGeometry args={[slabW - 0.05, 0.08, 2.7]} />
              <meshStandardMaterial
                color="#e2e8f0"
                roughness={0.7}
                transparent={!isVisible}
                opacity={isVisible ? 0.95 : 0.25}
              />
              <Edges color="#cbd5e1" />
            </mesh>
          );
        })}

        {/* Nhãn tầng bên cạnh */}
        {showLabels &&
          availableFloors.map((floorNum) => {
            const isSelected = selectedFloor === 0 || selectedFloor === floorNum;
            const labelX = -(slabW / 2 + 1.35);
            const labelY = (floorNum - 1) * FLOOR_STEP + 0.55;
            return (
              <Html
                key={`floor-lbl-${floorNum}`}
                position={[labelX, labelY, 0]}
                center
                portal={portalRef as any}
                zIndexRange={[5, 0]}
                className="r3f-html pointer-events-none"
                wrapperClass="r3f-html"
              >
                <div
                  style={{ zIndex: 5 }}
                  className={cn(
                    "pointer-events-none whitespace-nowrap text-[10px] font-extrabold tracking-[0.2em] transition-colors z-[5]",
                    isSelected ? "text-slate-500 font-black" : "text-slate-300"
                  )}
                >
                  TẦNG {floorNum}
                </div>
              </Html>
            );
          })}

        {/* Các khối phòng 3D */}
        {rooms.map((room) => {
          const matchesFloor = selectedFloor === 0 || room.floor === selectedFloor;
          const matchesStatus = !filterStatus || room.status === filterStatus;
          const dimmed = !matchesFloor || !matchesStatus;

          return (
            <RoomBlock
              key={room.id}
              room={room}
              centerCol={centerCol}
              total={roomTotal(room, settings)}
              selected={selectedId === room.id}
              hovered={hoveredId === room.id}
              flash={flashId === room.id}
              dimmed={dimmed}
              onHover={setHoveredId}
              onSelect={onSelect}
              portalRef={portalRef}
              showLabels={showLabels}
            />
          );
        })}
      </group>

      {/* Tắt bóng đổ thời gian thực nặng trên mobile để tiết kiệm GPU & giữ 60fps */}
      {!isMobile && (
        <ContactShadows
          position={[0, -0.46, 0]}
          opacity={0.25}
          scale={Math.max(13, slabW + 4)}
          blur={2.4}
          far={4}
        />
      )}

      <OrthographicCamera makeDefault position={[14, 14, 14]} zoom={isMobile ? 36 : 45} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        target={[0, 2.4, 0]}
        minZoom={20}
        maxZoom={120}
        touches={{
          ONE: TOUCH.ROTATE,
          TWO: TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

interface Props extends SceneProps {
  onSelectFloor: (floor: number) => void;
  isLocked?: boolean;
  showLabels?: boolean;
}

export default function Building3D({
  rooms,
  selectedFloor,
  onSelectFloor,
  isLocked = false,
  showLabels = true,
  ...sceneProps
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const availableFloors = useMemo(() => {
    const list = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
    return list.length > 0 ? list : [1, 2, 3];
  }, [rooms]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full isolate z-0", isLocked && "pointer-events-none")}
    >
      {/* Thanh chọn nhanh tầng ở góc trên bên phải vùng 3D */}
      <div className="pointer-events-auto absolute right-2.5 sm:right-5 top-2.5 sm:top-5 z-20 flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-md backdrop-blur">
        <span className="flex items-center gap-1 pl-1.5 pr-1 text-xs font-semibold text-slate-500">
          <Layers className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span className="hidden sm:inline">Tầng:</span>
        </span>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onSelectFloor(0);
          }}
          className={cn(
            "min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] px-2.5 py-1 flex items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-95 select-none",
            selectedFloor === 0
              ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          Tất cả
        </button>
        {availableFloors.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onSelectFloor(f);
            }}
            className={cn(
              "min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] px-2 py-1 flex items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-95 select-none",
              selectedFloor === f
                ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            T{f}
          </button>
        ))}
      </div>

      {/* Tối ưu DPR 1 - 1.5 & bắt sự kiện webglcontextlost chống crash trên điện thoại */}
      <Canvas
        dpr={[1, 1.5]}
        gl={{ powerPreference: "high-performance", antialias: true }}
        onCreated={({ gl }) => {
          const dom = gl.domElement;
          dom.addEventListener(
            "webglcontextlost",
            (event) => {
              event.preventDefault();
            },
            false
          );
        }}
        className="!h-full !w-full"
      >
        <BuildingScene
          rooms={rooms}
          selectedFloor={selectedFloor}
          isMobile={isMobile}
          portalRef={containerRef}
          showLabels={showLabels}
          {...sceneProps}
        />
      </Canvas>
    </div>
  );
}