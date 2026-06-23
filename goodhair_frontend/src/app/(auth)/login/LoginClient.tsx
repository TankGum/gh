'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { loginWithGoogle } from '@/services/auth.api';

export default function LoginClient() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        background: '#0F1E2B',
        border: '1px solid rgba(238,138,51,.25)',
        borderRadius: 14,
        padding: '36px 32px',
        boxShadow: '0 40px 90px rgba(0,0,0,.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 28 }}>
        <img
          src="/logo/logo.jpg"
          alt="GOODHAIR"
          style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover' }}
        />
        <span style={{ fontWeight: 800, fontSize: 20, color: '#F1ECE1', letterSpacing: 1 }}>
          GOOD<span style={{ color: '#EE8A33' }}>HAIR</span>
        </span>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F1ECE1', marginBottom: 8 }}>
        Đăng nhập hệ thống
      </h1>
      <p
        style={{
          fontSize: 13.5,
          color: 'rgba(241,236,225,.55)',
          marginBottom: 28,
          lineHeight: 1.6,
        }}
      >
        Dành cho quản trị &amp; nhân viên. Chỉ tài khoản được cấp quyền mới truy cập được.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <GoogleLogin
          onSuccess={async (res) => {
            if (!res.credential) return;
            try {
              await loginWithGoogle(res.credential);
              router.push('/services');
            } catch (err: unknown) {
              const e = err as { detail?: { status?: string } };
              const status = e.detail?.status;
              if (status === 'pending') {
                setMsg({
                  text: 'Tài khoản của bạn đang chờ quản trị viên duyệt.',
                  type: 'info',
                });
              } else if (status === 'rejected') {
                setMsg({
                  text: 'Yêu cầu truy cập của bạn đã bị từ chối. Vui lòng liên hệ quản trị viên.',
                  type: 'error',
                });
              } else {
                setMsg({ text: 'Đăng nhập thất bại. Vui lòng thử lại.', type: 'error' });
              }
            }
          }}
          onError={() => setMsg({ text: 'Google đăng nhập thất bại.', type: 'error' })}
          text="continue_with"
          shape="rectangular"
          theme="filled_blue"
          width="356"
        />
      </div>

      {msg && (
        <div
          style={{
            marginTop: 20,
            padding: '13px 15px',
            borderRadius: 8,
            fontSize: 13,
            background:
              msg.type === 'info' ? 'rgba(238,138,51,.12)' : 'rgba(214,120,120,.12)',
            border: `1px solid ${
              msg.type === 'info' ? 'rgba(238,138,51,.35)' : 'rgba(214,120,120,.35)'
            }`,
            color: msg.type === 'info' ? '#E7B25C' : '#E59A9A',
            lineHeight: 1.55,
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
