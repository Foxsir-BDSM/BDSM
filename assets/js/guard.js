import { getCurrentUser } from './auth.js';

export async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = '/landing.html';
        return false;
    }
    return true;
}

export function initGuard() {
    requireAuth().catch(() => {
        window.location.href = '/landing.html';
    });
}
