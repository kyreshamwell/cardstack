// middleware.ts: runs at the Edge before any page renders.
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
  // The demo runs entirely on fixture data and touches no account, so it stays
  // open, which is the point of it. It's also the only route that renders the
  // real dashboard without credentials, which is what makes it testable.
  '/demo',
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Where Google and Apple redirect back to. It has to be public: at the
  // moment the browser lands here the session does not exist yet, which is the
  // whole point of the page, so protecting it would bounce the user to
  // /sign-in and lose the OAuth response in the URL.
  '/sso-callback',
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
