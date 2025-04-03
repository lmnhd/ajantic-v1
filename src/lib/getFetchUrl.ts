export function getFetchUrl(route: string) {
  return `${
    process.env.NODE_ENV === "production" ? 'https://lyrical-drab.vercel.app' : "http://localhost:3000"}/${route}`;
}
