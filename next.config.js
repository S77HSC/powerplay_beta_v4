/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { esmExternals: 'loose' },

  images: {
    domains: [
      'flagcdn.com',
      'uitlajpnqruvvykrcyyg.supabase.co',
      'e0.365dm.com',
      'e1.365dm.com',
      'e2.365dm.com',
      'static.goal.com',
      'assets.goal.com',
    ],
    // If you ever need finer control, you can use remotePatterns instead of domains.
    // remotePatterns: [
    //   { protocol: 'https', hostname: 'flagcdn.com', pathname: '/**' },
    //   { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    // ],
  },

  async redirects() {
    return [
      // Server-side fallback: if someone hits "/", send them to /login
      { source: '/', destination: '/login', permanent: false },
    ];
  },
};

module.exports = nextConfig;
