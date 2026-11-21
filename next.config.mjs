/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // src/content/*.md-г (үйлчилгээний нөхцөл, гарын авлага) серверт fs-ээр уншдаг
  outputFileTracingIncludes: {
    "/*": ["src/content/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
