/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // La app de escritorio empaqueta el servidor autónomo que genera este modo.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @resvg/resvg-js trae binarios .node nativos que webpack no puede empaquetar
      config.externals = [...(config.externals || []), "@resvg/resvg-js"];
    }
    return config;
  },
};

export default nextConfig;