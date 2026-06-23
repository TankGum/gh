# GoodHair Frontend

Hệ thống quản lý chuỗi cắt tóc GoodHair. 
Dự án được xây dựng với Next.js (App Router), TypeScript và Tailwind CSS.

## Khởi động Local

Chỉ cần chạy lệnh sau để dựng Docker container:

```bash
docker-compose up -d --build
```

Ứng dụng sẽ khả dụng tại [http://localhost:3000](http://localhost:3000).

## Cấu trúc thư mục

- `src/app/`: Định tuyến và giao diện chính.
- `src/components/`: UI components dùng chung.
- `src/services/`: Quản lý call API đến FastAPI Backend.
- `src/types/`: Định nghĩa kiểu dữ liệu TypeScript.
