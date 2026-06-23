import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = { title: 'Đăng nhập | GoodHair' };

export default function LoginPage() {
  return <LoginClient />;
}
