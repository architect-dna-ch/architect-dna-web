export const config = {
  matcher: '/casemap/:path*',
};

const CASEMAP_USER = 'muharrem';
const CASEMAP_PASS = process.env.CASEMAP_PASSWORD;

export default function middleware(request) {
  const auth = request.headers.get('authorization');

  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      if (user === CASEMAP_USER && pass === CASEMAP_PASS) {
        return;
      }
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Case Map"',
    },
  });
}
