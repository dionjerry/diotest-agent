'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

const LEFT_MIN = 220;
const LEFT_MAX = 420;
const RIGHT_MIN = 360;
const RIGHT_MAX = 720;
const LEFT_KEY = 'diotest.studio.leftWidth';
const RIGHT_KEY = 'diotest.studio.rightWidth';
const LEFT_COLLAPSED_KEY = 'diotest.studio.leftCollapsed';
const RIGHT_COLLAPSED_KEY = 'diotest.studio.rightCollapsed';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ResizeHandle({
  side,
  active,
  collapsed,
  onPointerDown,
  onToggle,
}: {
  side: 'left' | 'right';
  active: boolean;
  collapsed: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onToggle: () => void;
}) {
  const toggleIcon = side === 'left'
    ? collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'
    : collapsed ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right';

  return (
    <div className="relative hidden w-3 flex-shrink-0 items-stretch justify-center lg:flex">
      <button
        type="button"
        aria-label={`Resize ${side} studio sidebar`}
        onPointerDown={onPointerDown}
        className={cn(
          'group relative flex w-full cursor-col-resize items-center justify-center transition-colors',
          active ? 'bg-emerald-500/8' : 'bg-transparent hover:bg-white/[0.03]',
        )}
      >
        <span
          className={cn(
            'h-full w-px transition-all duration-150',
            active ? 'bg-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.28)]' : 'bg-white/[0.08] group-hover:bg-white/[0.16]',
          )}
        />
        <span
          className={cn(
            'pointer-events-none absolute flex h-8 w-6 items-center justify-center rounded-full border text-zinc-500 transition-all',
            active
              ? 'border-emerald-500/25 bg-[#151a18] text-emerald-300 shadow-[0_10px_25px_rgba(0,0,0,0.25)]'
              : 'border-white/[0.08] bg-[#111216]/90 opacity-0 group-hover:opacity-100',
          )}
        >
          <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${side} studio sidebar`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={cn(
          'absolute bottom-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border transition-all',
          collapsed
            ? 'border-emerald-500/25 bg-[#13181a] text-emerald-300 hover:bg-[#172124]'
            : 'border-white/[0.08] bg-[#111216]/90 text-zinc-400 hover:border-white/[0.14] hover:text-zinc-200',
        )}
      >
        <span className="material-symbols-outlined text-[18px]">{toggleIcon}</span>
      </button>
    </div>
  );
}

export function StudioPanelsLayout({
  left,
  center,
  right,
  defaultLeftWidth = 260,
  defaultRightWidth = 620,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const leftExpandedWidth = useRef(defaultLeftWidth);
  const rightExpandedWidth = useRef(defaultRightWidth);

  useEffect(() => {
    const storedLeft = window.localStorage.getItem(LEFT_KEY);
    const storedRight = window.localStorage.getItem(RIGHT_KEY);
    const storedLeftCollapsed = window.localStorage.getItem(LEFT_COLLAPSED_KEY);
    const storedRightCollapsed = window.localStorage.getItem(RIGHT_COLLAPSED_KEY);
    if (storedLeft) {
      const next = clamp(Number(storedLeft), LEFT_MIN, LEFT_MAX);
      setLeftWidth(next);
      leftExpandedWidth.current = next;
    }
    if (storedRight) {
      const next = clamp(Number(storedRight), RIGHT_MIN, RIGHT_MAX);
      setRightWidth(next);
      rightExpandedWidth.current = next;
    }
    if (storedLeftCollapsed) setLeftCollapsed(storedLeftCollapsed === '1');
    if (storedRightCollapsed) setRightCollapsed(storedRightCollapsed === '1');
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      if (!rootRef.current) return;
      const bounds = rootRef.current.getBoundingClientRect();
      if (dragging === 'left') {
        const nextLeft = clamp(event.clientX - bounds.left, LEFT_MIN, LEFT_MAX);
        setLeftWidth(nextLeft);
        leftExpandedWidth.current = nextLeft;
        setLeftCollapsed(false);
        window.localStorage.setItem(LEFT_KEY, String(nextLeft));
        window.localStorage.setItem(LEFT_COLLAPSED_KEY, '0');
        return;
      }

      const nextRight = clamp(bounds.right - event.clientX, RIGHT_MIN, RIGHT_MAX);
      setRightWidth(nextRight);
      rightExpandedWidth.current = nextRight;
      setRightCollapsed(false);
      window.localStorage.setItem(RIGHT_KEY, String(nextRight));
      window.localStorage.setItem(RIGHT_COLLAPSED_KEY, '0');
    };

    const handlePointerUp = () => setDragging(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  const desktopStyles = useMemo(
    () => ({
      gridTemplateColumns: `${leftCollapsed ? 0 : leftWidth}px 12px minmax(0,1fr) 12px ${rightCollapsed ? 0 : rightWidth}px`,
    }),
    [leftCollapsed, leftWidth, rightCollapsed, rightWidth],
  );

  function toggleLeft() {
    if (leftCollapsed) {
      const next = clamp(leftExpandedWidth.current, LEFT_MIN, LEFT_MAX);
      setLeftWidth(next);
      setLeftCollapsed(false);
      window.localStorage.setItem(LEFT_KEY, String(next));
      window.localStorage.setItem(LEFT_COLLAPSED_KEY, '0');
      return;
    }

    leftExpandedWidth.current = leftWidth;
    setLeftCollapsed(true);
    window.localStorage.setItem(LEFT_COLLAPSED_KEY, '1');
  }

  function toggleRight() {
    if (rightCollapsed) {
      const next = clamp(rightExpandedWidth.current, RIGHT_MIN, RIGHT_MAX);
      setRightWidth(next);
      setRightCollapsed(false);
      window.localStorage.setItem(RIGHT_KEY, String(next));
      window.localStorage.setItem(RIGHT_COLLAPSED_KEY, '0');
      return;
    }

    rightExpandedWidth.current = rightWidth;
    setRightCollapsed(true);
    window.localStorage.setItem(RIGHT_COLLAPSED_KEY, '1');
  }

  return (
    <>
      <div className="lg:hidden">
        <div>{left}</div>
        <div>{center}</div>
        <div>{right}</div>
      </div>
      <div
        ref={rootRef}
        className={cn(
          'hidden min-h-[calc(100vh-65px)] lg:grid',
          dragging ? 'select-none' : '',
        )}
        style={desktopStyles}
      >
        <div className={cn('min-w-0 overflow-hidden transition-[opacity] duration-150', leftCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100')}>{left}</div>
        <ResizeHandle side="left" active={dragging === 'left'} collapsed={leftCollapsed} onPointerDown={() => setDragging('left')} onToggle={toggleLeft} />
        <div className="min-w-0">{center}</div>
        <ResizeHandle side="right" active={dragging === 'right'} collapsed={rightCollapsed} onPointerDown={() => setDragging('right')} onToggle={toggleRight} />
        <div className={cn('min-w-0 overflow-hidden transition-[opacity] duration-150', rightCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100')}>{right}</div>
      </div>
    </>
  );
}
