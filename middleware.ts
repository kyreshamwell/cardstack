// middleware.ts — runs at the Edge before any page renders.
//
// Clerk's middleware checks whether the user is authenticated on every request.
// Routes not in `isPublicRoute` will redirect unauthenticated users to /sign-in.
//
// Why Edge middleware?
//   Protection happens before any server component or API route runs,
//   so there's no risk of accidentally leaking protected data.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/demo(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Run middleware on all routes except Next.js internals and static files.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
}
