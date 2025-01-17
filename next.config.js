/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
    BITQUERY_API_KEY: process.env.BITQUERY_API_KEY,
    POLYGONSCAN_API_KEY: process.env.POLYGONSCAN_API_KEY,
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async'
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer')
      };
    }

    return config;
  },
};

module.exports = nextConfig; 