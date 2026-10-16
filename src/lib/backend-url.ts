/** Server calls use Vercel's runtime service binding; browser calls use the public /api rewrite. */
export const BACKEND_URL =
  typeof window !== "undefined"
    ? ""
    : process.env.BACKEND_URL ??
      (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")
