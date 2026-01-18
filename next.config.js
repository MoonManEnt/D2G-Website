/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  webpack: (config) => {
    // Handle canvas for Konva server-side
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    
    // Handle pdfjs worker
    config.resolve.alias.canvas = false;
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
