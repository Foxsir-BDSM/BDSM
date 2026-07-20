import { supabase } from './supabase-client.js';

// ★ 错误消息本地化映射 ★
function mapAuthError(message) {
    const map = {
        'Invalid login credentials': '邮箱或密码错误',
        'Email not confirmed': '邮箱未验证，请先验证邮箱',
        'Too many requests': '请求过于频繁，请稍后再试',
        'User already registered': '该邮箱已注册，请直接登录',
        'Invalid email': '邮箱格式不正确',
        'Password should be at least 6 characters': '密码长度不能少于6位',
    };
    return map[message] || message;
}

// 注册（支持昵称 + 身份元数据）
export async function signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                role: 'self',
                nickname: metadata.nickname || '',
                points: 0,
                ...metadata,
            },
        },
    });
    if (error) {
        return { data: null, error: { ...error, message: mapAuthError(error.message) } };
    }
    return { data, error };
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) {
        return { data: null, error: { ...error, message: mapAuthError(error.message) } };
    }
    return { data, error };
}

// 增强登出：清除本地缓存并跳转至引导页
export async function signOut() {
    localStorage.removeItem('foxsir_session');
    const { error } = await supabase.auth.signOut();
    if (!window.location.pathname.includes('landing.html')) {
        window.location.href = '/landing.html';
    }
    return { error };
}

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

// ===== R-01：Session 本地持久化 =====
export async function setSession(session) {
    if (session) {
        localStorage.setItem('foxsir_session', JSON.stringify(session));
    } else {
        localStorage.removeItem('foxsir_session');
    }
}

// ===== R-01：获取当前用户（优先本地缓存） =====
export async function getCurrentUser() {
    const stored = localStorage.getItem('foxsir_session');
    if (stored) {
        try {
            const session = JSON.parse(stored);
            if (session?.user) {
                return session.user;
            }
        } catch { /* ignore */ }
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await setSession(session);
            }
            return user;
        }
        return null;
    } catch {
        return null;
    }
}

// ===== R-02 + R-05：获取用户身份元数据（含头像） =====
export async function getUserIdentity() {
    const user = await getCurrentUser();
    if (!user) return null;
    const meta = user.user_metadata || {};
    return {
        primaryId: meta.primary_identity || null,
        primaryLabel: meta.primary_label || null,
        gender: meta.gender || null,
        roleType: meta.role_type || null,
        secondaryIds: meta.secondary_identities || [],
        nickname: meta.nickname || user.email?.split('@')[0] || '访客',
        role: meta.role || 'self',
        points: meta.points ?? 0,
        avatarUrl: meta.avatar_url || null,
    };
}

// ===== R-02：更新用户积分 =====
export async function updateUserPoints(newPoints) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: new Error('未登录') };
    }

    const points = Math.max(0, Math.floor(newPoints));

    const { data, error } = await supabase.auth.updateUser({
        data: {
            ...user.user_metadata,
            points: points,
        },
    });

    if (!error && data?.user) {
        const stored = localStorage.getItem('foxsir_session');
        if (stored) {
            try {
                const session = JSON.parse(stored);
                session.user = data.user;
                localStorage.setItem('foxsir_session', JSON.stringify(session));
            } catch { /* ignore */ }
        }
    }

    return { data, error };
}