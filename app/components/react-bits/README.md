# React Bits components

## Pricing: Spotlight Card and Star Border

`SpotlightCard.tsx`, `StarBorder.tsx` and `PricingEffects.module.css` adapt the
official TypeScript/CSS components, retaining the existing complete license in
`LICENSE.md` (Copyright 2026 David Haz, MIT + Commons Clause).

- https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Components/SpotlightCard
- https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Animations/StarBorder

The original cursor-relative radial spotlight and twin moving border gradients
are retained. Local changes scope CSS, make the border a decorative div, remove
fixed upstream padding/colors, throttle pointer updates to one animation frame,
clean up on unmount and disable motion for reduced-motion/coarse-pointer users.
The slow border is used only on the featured Blue pricing card. No WebGL, GSAP,
new dependencies, product/backend calls or moving price counters are added.

## Stack testimonials

`Stack.jsx` and `Stack.css` adapt the official JavaScript/CSS Stack source from the user's integration prompt: https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/Stack. The complete upstream license is preserved in the component and `LICENSE.md`.

The user explicitly requested the supplied Stack animation, not a custom flip. All eight keyed cards remain mounted. Normal-motion restacking uses the original formulas: rotation `(stack.length - index - 1) * 4 + randomRotate`, scale `1 + index * 0.06 - stack.length * 0.06`, origin `90% 90%`, spring stiffness 260/damping 20, 600px perspective, and 60-degree drag tilt. The example's random rotation and sensitivity 180 are enabled. No AnimatePresence, fade replacement, or custom 3D entrance/exit is added.

The matching `motion@12.42.2` wrapper uses the project's existing Framer Motion version. Local adaptations add controlled indexing for arrows/dots, keyboard and reduced-motion support, front-card-only accessibility, drag/click separation, and resetting a recycled card's drag offset. Touch screens are click-only to preserve vertical scrolling. The testimonials do not autoplay, load stock images, or request external data. Surface colors and typography use the Portal's existing light/dark tokens. The stack is clipped to its padded frame so cards cannot intercept controls below.

`lib/marketplaceTestimonials.ts` is a manually checked public Marketplace snapshot, not a live API integration. Refresh it from the documented anonymous endpoint when adding reviews. Names, ratings and updated dates are from the source; longer reviews use labelled verbatim excerpts. There are no invented roles, purchase-verification claims, or profile pictures.

## Laser Flow

Vendored official JavaScript/CSS variant supplied by the user in the approved integration prompt. Official reference: https://github.com/DavidHDev/react-bits/tree/1eeb6f105c68b964289d85dabbe84a1d551f3797/src/content/Animations/LaserFlow.

Pinned source commit: `1eeb6f105c68b964289d85dabbe84a1d551f3797`.

See LICENSE.md for the complete MIT + Commons Clause notice, also included in the component. Blue keeps the supplied shader, visibility handling, adaptive rendering resolution, and WebGL cleanup. Local adaptations add optional prop annotations, a client boundary, graceful renderer/shader/context-loss fallback, cleanup of scheduled resize frames, and a size-cache reset for fresh renderers under React Strict Mode.

The homepage wrapper loads this one component only after entering the viewport, honors reduced motion, uses a lower rendering resolution on mobile, and never loads it on account/payment pages. No model/provider requests are used.
