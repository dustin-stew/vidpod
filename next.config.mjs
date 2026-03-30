/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Treat node:sqlite as an external so webpack doesn't try to bundle it
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : []

      config.externals = [
        ...existingExternals,
        ({ request }, callback) => {
          if (request === 'node:sqlite') {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }
    return config
  },
}

export default nextConfig
