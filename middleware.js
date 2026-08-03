export const config = {
  matcher: ['/casemap/:path*', '/gallery/:path*', '/api/gallery/:path*'],
};

const REALMS = {
  '/casemap': {
    user: 'muharrem',
    pass: process.env.CASEMAP_PASSWORD,
    label: 'Case Map',
  },
  '/gallery': {
    user: 'liebe',
    pass: process.env.GALLERY_PASSWORD,
    label: 'Gallery',
  },
  '/api/gallery': {
    user: 'liebe',
    pass: process.env.GALLERY_PASSWORD,
    label: 'Gallery',
  },
};

function matchRealm(pathname) {
  if (pathname.startsWith('/casemap')) return REALMS['/casemap'];
  if (pathname.startsWith('/api/gallery')) return REALMS['/api/gallery'];
  if (pathname.startsWith('/gallery')) return REALMS['/gallery'];
  return null;
}

export default function middleware(request) {
  const realm = matchRealm(new URL(request.url).pathname);
  if (!realm) return;

  const auth = request.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      if (user === realm.user && pass === realm.pass) {
        return;
      }
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm.label}"`,
    },
  });
}
