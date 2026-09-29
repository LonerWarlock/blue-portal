'use client';

/*!
 * React Bits Stack — adapted from the user-supplied JavaScript/CSS source.
 * MIT + Commons Clause License Condition v1.0
 * 
 * Copyright (c) 2026 David Haz
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * ## Commons Clause Restriction
 * 
 * You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**
 * 
 * ## No Warranty
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import './Stack.css';

function CardRotate({ children, onSendToBack, sensitivity, disableDrag = false, active, enableClick, zIndex }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [60, -60]);
  const rotateY = useTransform(x, [-100, 100], [-60, 60]);
  const dragged = useRef(false);

  // Recycling a dragged card must not preserve its offset on its next turn.
  useEffect(() => { if (!active || disableDrag) { x.set(0); y.set(0); } }, [active, disableDrag, x, y]);

  function handleDragEnd(_, info) {
    if (Math.abs(info.offset.x) > sensitivity || Math.abs(info.offset.y) > sensitivity) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  }
  function click() {
    if (!active || !enableClick || dragged.current || window.getSelection()?.isCollapsed === false) return;
    onSendToBack();
  }
  if (disableDrag) {
    return <motion.div className="rb-stack-rotate rb-stack-click-only" style={{ x: 0, y: 0, zIndex, pointerEvents: active ? 'auto' : 'none' }} onClick={click} onPointerDownCapture={() => { dragged.current = false; }}>{children}</motion.div>;
  }
  return (
    <motion.div
      className="rb-stack-rotate"
      style={{ x, y, rotateX, rotateY, zIndex }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: 'grabbing' }}
      onPointerDownCapture={() => { dragged.current = false; }}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={handleDragEnd}
      onClick={click}
    >{children}</motion.div>
  );
}

/**
 * @typedef {object} StackProps
 * @property {import('react').ReactNode[]} [cards]
 * @property {boolean} [randomRotation]
 * @property {number} [sensitivity]
 * @property {boolean} [sendToBackOnClick]
 * @property {{stiffness: number, damping: number}} [animationConfig]
 * @property {boolean} [autoplay]
 * @property {number} [autoplayDelay]
 * @property {boolean} [pauseOnHover]
 * @property {boolean} [mobileClickOnly]
 * @property {number} [mobileBreakpoint]
 * @property {number} [activeIndex]
 * @property {(index: number) => void} [onActiveIndexChange]
 * @property {string} [ariaLabel]
 * @property {string} [describedBy]
 */
/** @param {StackProps} props */
export default function Stack({
  randomRotation = false,
  sensitivity = 200,
  cards = [],
  animationConfig = { stiffness: 260, damping: 20 },
  sendToBackOnClick = false,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  mobileClickOnly = false,
  mobileBreakpoint = 768,
  activeIndex,
  onActiveIndexChange,
  ariaLabel = 'Card stack',
  describedBy
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [internalIndex, setInternalIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const count = cards.length;
  const current = count ? ((activeIndex ?? internalIndex) % count + count) % count : 0;

  useEffect(() => {
    setClientReady(true);
    const coarse = window.matchMedia('(pointer: coarse)');
    const checkMobile = () => setIsMobile(window.innerWidth < mobileBreakpoint || coarse.matches);
    const visibility = () => setHidden(document.hidden);
    checkMobile();
    visibility();
    window.addEventListener('resize', checkMobile);
    coarse.addEventListener('change', checkMobile);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('resize', checkMobile);
      coarse.removeEventListener('change', checkMobile);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [mobileBreakpoint]);

  const change = useCallback(index => {
    if (count < 2) return;
    const next = (index % count + count) % count;
    if (activeIndex === undefined) setInternalIndex(next);
    onActiveIndexChange?.(next);
  }, [activeIndex, count, onActiveIndexChange]);

  // Same cyclic order as the supplied splice/unshift send-to-back operation.
  // Stable keys keep every card mounted for the original spring restacking.
  const stack = cards.map((_, layer) => {
    const id = (current + count - 1 - layer) % count;
    return { id, content: cards[id] };
  });
  const sendToBack = () => change(current + 1);
  const shouldDisableDrag = Boolean(reduceMotion || (mobileClickOnly && isMobile));
  const shouldEnableClick = sendToBackOnClick || (mobileClickOnly && isMobile);

  useEffect(() => {
    if (!autoplay || count < 2 || isPaused || hidden || reduceMotion) return;
    const timer = setInterval(() => change(current + 1), Math.max(1000, autoplayDelay));
    return () => clearInterval(timer);
  }, [autoplay, autoplayDelay, count, current, isPaused, hidden, reduceMotion, change]);

  return (
    <div
      className="rb-review-stack"
      role="group"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      tabIndex={count > 1 ? 0 : undefined}
      data-stack-index={current}
      data-reduced-motion={Boolean(reduceMotion)}
      data-drag-enabled={!shouldDisableDrag}
      onKeyDown={event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          change(current + (event.key === 'ArrowRight' ? 1 : -1));
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          change(event.key === 'Home' ? 0 : count - 1);
        }
      }}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      onFocus={() => pauseOnHover && setIsPaused(true)}
      onBlur={event => { if (pauseOnHover && !event.currentTarget.contains(event.relatedTarget)) setIsPaused(false); }}
    >
      {stack.map((card, index) => {
        const active = index === stack.length - 1;
        // Random rotations start after hydration; server/client HTML must agree.
        const randomRotate = randomRotation && clientReady ? Math.random() * 10 - 5 : 0;
        return (
          <CardRotate key={card.id} onSendToBack={sendToBack} sensitivity={sensitivity} disableDrag={shouldDisableDrag || !active} active={active} enableClick={shouldEnableClick} zIndex={index}>
            <motion.div
              className="rb-stack-card rb-stack-layer"
              role="group"
              aria-roledescription="slide"
              aria-label={`Review ${card.id + 1} of ${count}`}
              aria-hidden={!active}
              data-stack-active={active}
              data-card-index={card.id}
              animate={{
                rotateZ: reduceMotion ? 0 : (stack.length - index - 1) * 4 + randomRotate,
                scale: reduceMotion ? 1 : 1 + index * 0.06 - stack.length * 0.06,
                transformOrigin: '90% 90%'
              }}
              initial={false}
              transition={reduceMotion ? { duration: 0 } : {
                type: 'spring',
                stiffness: animationConfig.stiffness,
                damping: animationConfig.damping
              }}
            ><div className="rb-stack-content">{card.content}</div></motion.div>
          </CardRotate>
        );
      })}
    </div>
  );
}
