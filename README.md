# FOODIFI Backend

Backend cho ung dung cua hang thuc pham, xay dung bang `Node.js`, `Express.js`, `MySQL` va `Sequelize ORM`.

## Cong nghe

- `Node.js`
- `Express.js`
- `MySQL`
- `Sequelize ORM`
- `JWT Authentication`
- `Socket.IO`
- `Swagger`
- `Multer`
- `Nodemailer`

## Chuc nang chinh

- Dang ky, dang nhap, refresh token, logout
- Quan ly nguoi dung, dia chi, phan quyen
- Quan ly danh muc va san pham
- Tim kiem, loc, phan trang san pham
- Danh gia san pham va cong thuc
- Quan ly cong thuc nau an
- Gio hang, don hang, thanh toan online mock
- Quan ly kho:
  - nhap kho
  - dieu chinh tang/giam
  - hang hong
  - tra nha cung cap
  - lich su bien dong ton kho
- Chi mo ban san pham khi duoc publish
- Upload anh
- Thong bao
- Chat realtime giua khach hang va cua hang
- Tai lieu API bang Swagger

## Cau truc thu muc

```text
config/         Cau hinh ket noi
controllers/    Xu ly request/response
docs/           Swagger docs
middlewares/    JWT, upload, middleware dung chung
models/         ORM models va xu ly du lieu
routes/         Dinh nghia API routes
scripts/        Script init/reset/seed database
services/       Email, token, notification
sockets/        Chat realtime voi Socket.IO
utils/          Ham ho tro dung chung
database/       So do va file SQL tham khao
```

## Cai dat

### 1. Clone project

```bash
git clone https://github.com/Vuquangngan/BackEnd_ShopFood.git
cd BackEnd_ShopFood
```

### 2. Cai dependencies

```bash
npm install
```

### 3. Tao file moi truong

Tao file `.env` tu `.env.example`.

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=shopfood
JWT_SECRET=secretkey
GOOGLE_WEB_CLIENT_ID=

EMAIL_HOST=
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM_NAME=FOODIFI
EMAIL_FROM_ADDRESS=
UPLOAD_MAX_FILE_SIZE_MB=5
```

## Khoi tao database

### Tao/cap nhat schema ORM

```bash
npm run db:init
```

### Seed du lieu mau

```bash
npm run db:seed
```

### Reset va seed lai toan bo

```bash
npm run db:fresh
```

## Chay project

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

Server mac dinh:

```text
http://localhost:3000
```

## Tai lieu API

- Swagger UI: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- Swagger JSON: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

## Tai khoan mau

### Admin

- `vuquangngan312@gmail.com / ngan@312`
- `nganhanoi312@gmail.com / ngan@312`

### Customer

- `customer@shopfood.vn / Customer@123456`

## API noi bat

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`

### Products

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `PATCH /api/products/:id/publish`
- `PATCH /api/products/:id/unpublish`

### Orders

- `GET /api/orders/my-orders`
- `POST /api/orders`
- `PUT /api/orders/:id/status`
- `GET /api/orders/:id/payments`

### Inventory

- `GET /api/inventory/suppliers`
- `POST /api/inventory/suppliers`
- `GET /api/inventory/documents`
- `POST /api/inventory/documents`
- `POST /api/inventory/documents/:id/complete`
- `GET /api/inventory/transactions`

### Chat

- `GET /api/chat/conversations`
- `POST /api/chat/conversations`
- `GET /api/chat/conversations/:id/messages`
- `POST /api/chat/conversations/:id/messages`

## Ghi chu

- File `.env` da duoc bo khoi git.
- Thu muc `node_modules` khong duoc day len repository.
- Chat realtime su dung `Socket.IO`.
- He thong dang dung `RESTful API` de ket noi voi app mobile.

## Tac gia

Vu Quang Ngan
