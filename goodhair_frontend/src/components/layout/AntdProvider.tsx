'use client';

import { ConfigProvider, theme, App } from 'antd';
import type { ReactNode } from 'react';

export default function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#ee8a33',
          colorBgContainer: '#0a131d',
          colorBgElevated: '#161e31',
          colorBorder: '#1e293b',
          colorText: '#cbd5e1',
          colorTextHeading: '#ffffff',
          borderRadius: 6,
          fontFamily: 'inherit',
        },
        components: {
          Menu: {
            darkItemBg: 'transparent',
            darkItemColor: '#94a3b8',
            darkItemHoverBg: '#161e31',
            darkItemHoverColor: '#ffffff',
            darkItemSelectedBg: '#1e293b',
            darkItemSelectedColor: '#ee8a33',
            itemBorderRadius: 6,
          },
          Table: {
            headerBg: '#0a131d',
            headerColor: '#94a3b8',
            rowHoverBg: '#161e3180',
            borderColor: '#1e293b',
          },
          Modal: {
            contentBg: '#0a131d',
            headerBg: '#0a131d',
            titleColor: '#ffffff',
          },
          Form: {
            labelColor: '#94a3b8',
          },
          Button: {
            defaultBg: '#161e31',
            defaultBorderColor: '#1e293b',
            defaultColor: '#cbd5e1',
            defaultHoverBg: '#1e293b',
            defaultHoverBorderColor: '#334155',
            defaultHoverColor: '#ffffff',
            primaryColor: '#0B1620',
            primaryShadow: '0 2px 0 rgba(238,138,51,0.3)',
          },
          Select: {
            fontSizeLG: 13,
            optionFontSize: 13,
          },
          Input: {
            fontSizeLG: 13,
          },
          Switch: {
            colorPrimary: '#10b981',
          },
          Message: {
            contentBg: '#161e31',
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
