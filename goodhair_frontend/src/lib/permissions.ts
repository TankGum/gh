import type { PermissionMap } from '@/types/role.type';

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

/** Maps an admin route prefix to its permission module. */
export const ROUTE_MODULE: Record<string, string> = {
  '/dashboard': 'overview',
  '/manage-bookings': 'bookings',
  '/revenue': 'revenue',
  '/employees': 'staff',
  '/shifts': 'shifts',
  '/customers': 'customers',
  '/branches': 'branches',
  '/services': 'services',
  '/accounts': 'roles',
  '/roles': 'roles',
  '/audit-log': 'logs',
};

export function hasPermission(
  permissions: Record<string, PermissionMap> | undefined,
  module: string,
  action: PermAction,
): boolean {
  return Boolean(permissions?.[module]?.[action]);
}

/** First route the user is allowed to view, or null if none. */
export function firstAllowedRoute(
  permissions: Record<string, PermissionMap> | undefined,
): string | null {
  for (const [route, module] of Object.entries(ROUTE_MODULE)) {
    if (hasPermission(permissions, module, 'view')) return route;
  }
  return null;
}

/** Module for a given pathname (longest matching prefix), or null. */
export function moduleForPath(pathname: string): string | null {
  let match: { len: number; module: string } | null = null;
  for (const [route, module] of Object.entries(ROUTE_MODULE)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (!match || route.length > match.len) match = { len: route.length, module };
    }
  }
  return match?.module ?? null;
}
