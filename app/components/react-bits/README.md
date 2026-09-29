# React Bits Laser Flow

Vendored official JavaScript/CSS variant supplied by the user in the approved integration prompt. Official reference: https://github.com/DavidHDev/react-bits/tree/1eeb6f105c68b964289d85dabbe84a1d551f3797/src/content/Animations/LaserFlow.

Pinned source commit: `1eeb6f105c68b964289d85dabbe84a1d551f3797`.

See LICENSE.md for the complete MIT + Commons Clause notice, also included in the component. Blue keeps the supplied shader, visibility handling, adaptive rendering resolution, and WebGL cleanup. Local adaptations add optional prop annotations, a client boundary, graceful renderer/shader/context-loss fallback, cleanup of scheduled resize frames, and a size-cache reset for fresh renderers under React Strict Mode.

The homepage wrapper loads this one component only after entering the viewport, honors reduced motion, uses a lower rendering resolution on mobile, and never loads it on account/payment pages. No model/provider requests are used.
