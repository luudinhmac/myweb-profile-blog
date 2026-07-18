import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isValidRequestId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9\-_.]+$/.test(id);

const sanitizeUrl = (url: string): string => {
  return url.replace(/(token|password|secret|jwt|code|accessToken)=([^&]+)/ig, '$1=***');
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass health check endpoint immediately to avoid backend calls, proxying, or maintenance redirects
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  const startTime = Date.now();
  const method = request.method;

  // Generate dynamic CSP nonce
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev 
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com;`
    : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://static.cloudflareinsights.com;`;

  const cspHeader = `default-src 'self'; ${scriptSrc} style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https: http://localhost:3001 http://portfolio-backend-staging:3001; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://staging.luumac.io.vn https://cloudflareinsights.com http://localhost:3001 http://portfolio-backend-staging:3001; frame-ancestors 'self';`;

  // Capture client IP
  const rawIp = 
    request.headers.get('cf-connecting-ip') || 
    request.headers.get('x-forwarded-for') || 
    request.headers.get('x-real-ip') || 
    '';
  const clientIp = rawIp.split(',')[0].trim() || 'unknown';

  // Request ID & CF-Ray logic (Validate input headers)
  const incomingRequestId = request.headers.get('x-request-id');
  const requestId = isValidRequestId(incomingRequestId) ? incomingRequestId : crypto.randomUUID();

  const incomingCfRay = request.headers.get('cf-ray');
  const cfRay = isValidRequestId(incomingCfRay) ? incomingCfRay : undefined;
  
  const requestHeaders = new Headers(request.headers);
  if (clientIp && clientIp !== 'unknown') {
    requestHeaders.set('x-original-client-ip', clientIp);
  }
  
  // Set x-nonce header in request headers so Server Components can read it
  requestHeaders.set('x-nonce', nonce);

  // Set Request ID and CF-Ray headers
  requestHeaders.set('x-request-id', requestId);
  if (cfRay) {
    requestHeaders.set('cf-ray', cfRay);
  }

  const isApiOrUpload = pathname.startsWith('/api') || pathname.startsWith('/uploads');

  const logAndReturn = (res: NextResponse) => {
    const duration = Date.now() - startTime;
    const sanitizedPath = sanitizeUrl(pathname + request.nextUrl.search);
    
    // Gán response headers cho client trace
    res.headers.set('X-Request-ID', requestId);
    if (cfRay) {
      res.headers.set('cf-ray', cfRay);
    }
    if (!isApiOrUpload) {
      res.headers.set('Content-Security-Policy', cspHeader);
    }

    console.log(
      `[Middleware] [ReqID: ${requestId}] [CF-Ray: ${cfRay || 'N/A'}] ${method} ${sanitizedPath} - Status: ${res.status} (${duration}ms) from IP: ${clientIp}`
    );
    return res;
  };

  // Dynamic Runtime Proxy for API and Uploads
  if (isApiOrUpload) {
    let fetchUrl = process.env.INTERNAL_API_URL;
    if (!fetchUrl) {
      console.warn(`[Middleware] [ReqID: ${requestId}] [CF-Ray: ${cfRay || 'N/A'}] INTERNAL_API_URL is not defined. Passing request through.`);
      return logAndReturn(NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }));
    }

    const backendBaseUrl = fetchUrl
        .replace(/\/api\/v1\/?$/, '')
        .replace(/\/api\/?$/, '')
        .replace(/\/$/, '');

    const targetUrl = new URL(pathname + request.nextUrl.search, backendBaseUrl);
    return logAndReturn(NextResponse.rewrite(targetUrl, {
      request: {
        headers: requestHeaders,
      },
    }));
  }

  // Define excluded paths (always accessible pages)
  const isExcludedPath = 
    pathname.startsWith('/maintenance') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images') ||
    pathname.endsWith('.pdf');

  if (isExcludedPath) {
    return logAndReturn(NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }));
  }

  // Check for Bypass Cookie and User Role
  const bypassCookie = request.cookies.get('MAINTENANCE_BYPASS');
  const userToken = request.cookies.get('access_token');
  const userRole = request.cookies.get('user_role')?.value;
  
  const isAdmin = ['admin', 'superadmin'].includes(userRole || '');
  const hasPasscode = !!bypassCookie;

  // Check for Maintenance Status (with simple in-memory cache)
  try {
    const CACHE_KEY = 'MAINTENANCE_STATUS_CACHE';
    const CACHE_TTL = 10000; // 10 seconds
    const now = Date.now();
    const cached = (globalThis as any)[CACHE_KEY];
    
    let isGlobalMaintenance = false;
    
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      isGlobalMaintenance = cached.status;
    } else {
      let fetchUrl = process.env.INTERNAL_API_URL;
      
      if (!fetchUrl) {
        throw new Error('INTERNAL_API_URL is not defined in proxy middleware');
      } else {
        if (!fetchUrl.includes('/v1')) {
          fetchUrl = fetchUrl.replace(/\/api\/?$/, '') + '/api/v1';
        }
        if (!fetchUrl.endsWith('/settings/public')) {
          fetchUrl = fetchUrl.replace(/\/$/, '') + '/settings/public';
        }
      }
      
      const response = await fetch(fetchUrl, { 
        cache: 'no-store',
        signal: AbortSignal.timeout(3000) 
      });
      
      if (response.ok) {
        const settings = await response.json();
        isGlobalMaintenance = settings.maintenance_global === 'true' || settings.maintenance_global === true;
        (globalThis as any)[CACHE_KEY] = {
          status: isGlobalMaintenance,
          timestamp: now
        };
      }
    }
    
    // Maintenance Enforcement Logic
    if (isGlobalMaintenance) {
      if (isAdmin && userToken) {
        return logAndReturn(NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        }));
      }

      if (hasPasscode && (pathname === '/login' || pathname.startsWith('/_next') || pathname.startsWith('/api'))) {
        return logAndReturn(NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        }));
      }

      if (pathname !== '/maintenance') {
        console.log(`[Middleware] REDIRECTING to /maintenance from ${pathname} (Maintenance ON, No Admin/Passcode)`);
        const url = new URL('/maintenance', request.url);
        url.searchParams.set('from', pathname);
        return logAndReturn(NextResponse.redirect(url));
      }
    }
  } catch (error: any) {
    console.error(`[Middleware] Maintenance check failed: ${error.message}`);
  }

  // Admin Stealth Protection
  if (pathname.startsWith('/portal-dashboard') && pathname !== '/portal-dashboard/login') {
    const token = request.cookies.get('token') || request.cookies.get('access_token');
    if (!token) {
      const allCookies = request.cookies.getAll().map(c => c.name);
      console.log(`[Security] Unauthorized access to ${pathname}. Cookies found: ${allCookies.join(', ') || 'none'}. Rewriting to 404.`);
      return logAndReturn(NextResponse.rewrite(new URL('/not-found-stealth', request.url)));
    }
  }

  return logAndReturn(NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  }));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
