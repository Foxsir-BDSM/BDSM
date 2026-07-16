// ============================================================
// 头像上传 / 压缩 / 管理
// Supabase Storage + Canvas 压缩
// ============================================================

import { supabase } from './supabase-client.js';
import { getCurrentUser } from './auth.js';

// 压缩参数
const AVATAR_CONFIG = {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.8,
    format: 'image/webp',
    maxSizeKB: 20,
};

/**
 * 使用 Canvas 压缩图片
 * @param {File} file - 原始图片文件
 * @returns {Promise<Blob>} 压缩后的 Blob
 */
export function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { maxWidth, maxHeight } = AVATAR_CONFIG;

                let width = img.width;
                let height = img.height;

                // 等比缩放
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height / width) * maxWidth;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width / height) * maxHeight;
                        height = maxHeight;
                    }
                }

                canvas.width = Math.round(width);
                canvas.height = Math.round(height);

                const ctx = canvas.getContext('2d');
                // 绘制（方形裁剪 + 圆角？保持原比例，不裁剪）
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('压缩失败'));
                            return;
                        }
                        // 检查大小是否超标（可选：若 >20KB 可二次压缩，这里先返回）
                        resolve(blob);
                    },
                    AVATAR_CONFIG.format,
                    AVATAR_CONFIG.quality
                );
            };
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

/**
 * 上传头像
 * @param {File} file - 原始图片文件（自动压缩）
 * @param {string} userId - 用户 ID
 * @returns {Promise<{ data: any, error: any, publicUrl: string }>}
 */
export async function uploadAvatar(file, userId) {
    try {
        // 1. 压缩
        const compressedBlob = await compressImage(file);

        // 2. 构建文件路径
        const fileExt = 'webp';
        const fileName = `avatar.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // 3. 上传到 Supabase Storage
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, compressedBlob, {
                cacheControl: '3600',
                upsert: true, // 覆盖旧头像
                contentType: 'image/webp',
            });

        if (error) throw error;

        // 4. 获取公开 URL
        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const publicUrl = urlData?.publicUrl || '';

        // 5. 更新用户元数据（存储头像 URL）
        const user = await getCurrentUser();
        if (user) {
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    ...user.user_metadata,
                    avatar_url: publicUrl,
                },
            });
            if (updateError) {
                console.warn('[avatar] 更新元数据失败，但图片已上传:', updateError);
                // 不阻断流程
            } else {
                // 刷新本地缓存
                const stored = localStorage.getItem('foxsir_session');
                if (stored) {
                    try {
                        const session = JSON.parse(stored);
                        if (session?.user) {
                            session.user.user_metadata = {
                                ...session.user.user_metadata,
                                avatar_url: publicUrl,
                            };
                            localStorage.setItem('foxsir_session', JSON.stringify(session));
                        }
                    } catch { /* ignore */ }
                }
            }
        }

        return { data, error: null, publicUrl };
    } catch (err) {
        return { data: null, error: err, publicUrl: '' };
    }
}

/**
 * 获取用户头像 URL
 * @param {string} userId - 用户 ID
 * @returns {Promise<string>} 头像 URL 或空字符串
 */
export async function getAvatarUrl(userId) {
    if (!userId) return '';
    const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar.webp`);
    return data?.publicUrl || '';
}

/**
 * 删除用户头像
 * @param {string} userId - 用户 ID
 * @returns {Promise<{ error: any }>}
 */
export async function deleteAvatar(userId) {
    if (!userId) return { error: new Error('缺少用户 ID') };
    const filePath = `${userId}/avatar.webp`;

    const { error } = await supabase.storage.from('avatars').remove([filePath]);

    if (!error) {
        // 清除元数据中的 avatar_url
        const user = await getCurrentUser();
        if (user) {
            const meta = { ...user.user_metadata };
            delete meta.avatar_url;
            await supabase.auth.updateUser({ data: meta });
            // 刷新本地缓存
            const stored = localStorage.getItem('foxsir_session');
            if (stored) {
                try {
                    const session = JSON.parse(stored);
                    if (session?.user) {
                        session.user.user_metadata = meta;
                        localStorage.setItem('foxsir_session', JSON.stringify(session));
                    }
                } catch { /* ignore */ }
            }
        }
    }

    return { error };
}