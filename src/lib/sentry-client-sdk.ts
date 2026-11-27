// The two functions the browser uses from the Sentry SDK, and nothing else.
//
// lib/sentry-client.ts loads THIS file with import(), not "@sentry/nextjs"
// itself: a dynamic import of the package would pull in every export it has
// (replay, feedback, tracing) because nothing can be tree-shaken out of
// "give me the whole module". Named imports here let the bundler keep only
// what these two need.
export { captureException, init } from "@sentry/nextjs";
