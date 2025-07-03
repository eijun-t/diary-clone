import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip authentication for specific API routes
  const pathname = request.nextUrl.pathname;
  
  // Allow cron endpoints without authentication
  if (pathname.startsWith('/api/cron/')) {
    return;
  }
  
  // Allow admin endpoints in development
  if (pathname.startsWith('/api/admin/') && process.env.NODE_ENV !== 'production') {
    return;
  }
  
  // Allow test endpoints in development
  if (pathname.startsWith('/api/test/') && process.env.NODE_ENV !== 'production') {
    return;
  }
  
  // Allow test pages in development
  if (pathname.startsWith('/test/') && process.env.NODE_ENV !== 'production') {
    return;
  }
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
