/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @resvg/resvg-js trae binarios .node nativos que webpack no puede empaquetar
      config.externals = [...(config.externals || []), "@resvg/resvg-js"];
    }
    return config;
  },
};

export default nextConfig;