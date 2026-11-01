# Software Design Document (SDD)

## Inventory Management System --- Backend

**Repository:** `inventory-backend`\
**Framework:** Express.js\
**Runtime:** Node.js 22\
**Language:** JavaScript (atau TypeScript jika diputuskan saat
bootstrap)\
**ORM:** Prisma\
**Database:** Google Cloud SQL for MySQL 8.0\
**Deployment:** Google Kubernetes Engine (GKE) Standard\
**Document version:** 1.0

------------------------------------------------------------------------

## 1. Purpose and scope

Dokumen ini menjadi acuan implementasi backend Inventory Management
System (IMS). Backend menyediakan REST API, autentikasi, authorization,
business logic inventaris, validasi, dan akses database.

Backend merupakan satu-satunya service aplikasi yang boleh mengakses
database Cloud SQL. Frontend Next.js berkomunikasi dengan backend
melalui HTTP API.

### 1.1 Goals

-   Menyediakan REST API versi `/api/v1`.
-   Mengelola user, kategori, produk, dan pergerakan stok.
-   Menjamin konsistensi transaksi stok.
-   Menerapkan autentikasi dan role-based authorization.
-   Menggunakan Prisma ORM dan migration.
-   Terhubung ke Cloud SQL MySQL melalui Cloud SQL Auth Proxy.
-   Dapat dijalankan sebagai container di GKE.
-   Memiliki pipeline CI/CD independen dari frontend.

### 1.2 Out of scope

-   Rendering halaman web.
-   Akses database langsung dari browser.
-   Pengelolaan UI dan state frontend.
-   Penyediaan database engine sendiri di Kubernetes.

------------------------------------------------------------------------

## 2. Architecture

``` text
Next.js Frontend
      |
      | HTTPS / REST API
      v
GKE Ingress / Google Cloud Load Balancer
      |
      v
backend-service (ClusterIP :5000)
      |
      v
Express.js Pod
      |
      +---- Prisma ORM
      |
      +---- localhost:3306
                  |
                  v
           Cloud SQL Auth Proxy
                  |
                  v
          Google Cloud SQL
              MySQL 8.0
```

Cloud SQL Auth Proxy berjalan sebagai sidecar pada Pod yang sama dengan
backend. Express mengakses proxy melalui `127.0.0.1:3306`. Proxy
mengautentikasi koneksi ke Cloud SQL menggunakan identitas workload GKE.

### 2.1 Technology stack

  Area                    Technology
  ----------------------- --------------------------------------
  Runtime                 Node.js 22
  Framework               Express.js
  Database                MySQL 8.0
  ORM                     Prisma
  Authentication          JWT/session strategy
  Password hashing        bcrypt
  Validation              Zod or express-validator
  Container               Docker
  Registry                Docker Hub
  Orchestration           GKE Standard
  Database connectivity   Cloud SQL Auth Proxy
  Cloud identity          Workload Identity Federation for GKE
  CI/CD                   Jenkins
  Source control          GitHub

Gunakan versi dependency yang dipin melalui `package-lock.json`.
Validasi kompatibilitas versi Prisma, Node.js, dan MySQL saat bootstrap
project.

------------------------------------------------------------------------

## 3. Repository structure

``` text
inventory-backend/
├── src/
│   ├── config/
│   │   ├── env.js
│   │   └── database.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── product.controller.js
│   │   ├── category.controller.js
│   │   └── stock.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── product.service.js
│   │   ├── category.service.js
│   │   └── stock.service.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── product.routes.js
│   │   ├── category.routes.js
│   │   ├── stock.routes.js
│   │   └── health.routes.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   ├── validate.middleware.js
│   │   └── error.middleware.js
│   ├── validators/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── tests/
│   ├── unit/
│   └── integration/
├── k8s/
│   ├── namespace.yaml
│   ├── service-account.yaml
│   ├── configmap.yaml
│   └── backend.yaml
├── Dockerfile
├── .dockerignore
├── .env.example
├── .gitignore
├── Jenkinsfile
└── package.json
```

------------------------------------------------------------------------

## 4. Database design

**Database name:** `inventory_db`\
**Engine:** MySQL 8.0\
**Hosting:** Google Cloud SQL

### 4.1 Entity relationship

``` text
users
  |
  | 1:N
  v
stock_movements
  ^
  | N:1
  |
products
  ^
  | N:1
  |
categories
```

Relasi:

  Parent       Child             Relationship
  ------------ ----------------- --------------
  categories   products          One-to-Many
  products     stock_movements   One-to-Many
  users        stock_movements   One-to-Many

### 4.2 Table definitions

**users**

  Column          Type              Constraint
  --------------- ----------------- ---------------------------
  id              BIGINT UNSIGNED   PK, AUTO_INCREMENT
  name            VARCHAR(100)      NOT NULL
  email           VARCHAR(150)      UNIQUE, NOT NULL
  password_hash   VARCHAR(255)      NOT NULL
  role            ENUM              ADMIN / STAFF
  created_at      TIMESTAMP         DEFAULT CURRENT_TIMESTAMP
  updated_at      TIMESTAMP         ON UPDATE

**categories**

  Column        Type              Constraint
  ------------- ----------------- ---------------------------
  id            BIGINT UNSIGNED   PK
  name          VARCHAR(100)      UNIQUE, NOT NULL
  description   TEXT              NULL
  created_at    TIMESTAMP         DEFAULT CURRENT_TIMESTAMP
  updated_at    TIMESTAMP         ON UPDATE

**products**

  Column           Type              Constraint
  ---------------- ----------------- ---------------------------
  id               BIGINT UNSIGNED   PK
  category_id      BIGINT UNSIGNED   FK categories.id
  sku              VARCHAR(50)       UNIQUE, NOT NULL
  name             VARCHAR(150)      NOT NULL
  description      TEXT              NULL
  purchase_price   DECIMAL(15,2)     DEFAULT 0
  selling_price    DECIMAL(15,2)     DEFAULT 0
  stock_quantity   INT UNSIGNED      DEFAULT 0
  minimum_stock    INT UNSIGNED      DEFAULT 5
  created_at       TIMESTAMP         DEFAULT CURRENT_TIMESTAMP
  updated_at       TIMESTAMP         ON UPDATE

**stock_movements**

  Column             Type              Constraint
  ------------------ ----------------- ---------------------------
  id                 BIGINT UNSIGNED   PK
  product_id         BIGINT UNSIGNED   FK products.id
  user_id            BIGINT UNSIGNED   FK users.id
  type               ENUM              IN / OUT / ADJUSTMENT
  quantity           INT UNSIGNED      NOT NULL
  reference_number   VARCHAR(100)      UNIQUE, NULL
  notes              TEXT              NULL
  created_at         TIMESTAMP         DEFAULT CURRENT_TIMESTAMP

### 4.3 SQL initialization

``` sql
CREATE DATABASE inventory_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE inventory_db;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','STAFF') NOT NULL DEFAULT 'STAFF',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  minimum_stock INT UNSIGNED NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT
);

CREATE TABLE stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('IN','OUT','ADJUSTMENT') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  reference_number VARCHAR(100) UNIQUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movement_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_movement_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_movements_product_date
  ON stock_movements(product_id, created_at);
CREATE INDEX idx_movements_type ON stock_movements(type);
```

**Schema ownership:** pilih Prisma Schema sebagai source of truth untuk
implementasi. SQL di atas merupakan referensi desain; generate dan
review migration Prisma agar tidak terjadi drift antara SQL manual dan
ORM.

------------------------------------------------------------------------

## 5. Prisma schema

File `prisma/schema.prisma`:

``` prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id           BigInt           @id @default(autoincrement()) @db.UnsignedBigInt
  name         String           @db.VarChar(100)
  email        String           @unique @db.VarChar(150)
  passwordHash String           @map("password_hash") @db.VarChar(255)
  role         UserRole         @default(STAFF)
  movements    StockMovement[]
  createdAt    DateTime         @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt    DateTime         @updatedAt @map("updated_at") @db.Timestamp(0)

  @@map("users")
}

model Category {
  id          BigInt    @id @default(autoincrement()) @db.UnsignedBigInt
  name        String    @unique @db.VarChar(100)
  description String?   @db.Text
  products    Product[]
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamp(0)

  @@map("categories")
}

model Product {
  id            BigInt           @id @default(autoincrement()) @db.UnsignedBigInt
  categoryId    BigInt           @map("category_id") @db.UnsignedBigInt
  sku           String           @unique @db.VarChar(50)
  name          String           @db.VarChar(150)
  description   String?          @db.Text
  purchasePrice Decimal          @default(0) @map("purchase_price") @db.Decimal(15, 2)
  sellingPrice  Decimal          @default(0) @map("selling_price") @db.Decimal(15, 2)
  stockQuantity Int              @default(0) @map("stock_quantity") @db.UnsignedInt
  minimumStock  Int              @default(5) @map("minimum_stock") @db.UnsignedInt
  category      Category         @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  movements     StockMovement[]
  createdAt     DateTime         @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt     DateTime         @updatedAt @map("updated_at") @db.Timestamp(0)

  @@index([categoryId])
  @@index([name])
  @@map("products")
}

model StockMovement {
  id              BigInt        @id @default(autoincrement()) @db.UnsignedBigInt
  productId       BigInt        @map("product_id") @db.UnsignedBigInt
  userId          BigInt        @map("user_id") @db.UnsignedBigInt
  type            MovementType
  quantity        Int           @db.UnsignedInt
  referenceNumber String?       @unique @map("reference_number") @db.VarChar(100)
  notes           String?       @db.Text
  product         Product       @relation(fields: [productId], references: [id], onDelete: Restrict)
  user            User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamp(0)

  @@index([productId, createdAt])
  @@index([type])
  @@map("stock_movements")
}

enum UserRole {
  ADMIN
  STAFF

  @@map("users_role")
}

enum MovementType {
  IN
  OUT
  ADJUSTMENT

  @@map("movement_type")
}
```

Pastikan enum mapping dan tipe timestamp sesuai dengan migration yang
dihasilkan oleh versi Prisma yang digunakan. Review migration sebelum
diterapkan ke Cloud SQL.

------------------------------------------------------------------------

## 6. Business rules

### 6.1 Product

-   SKU harus unik.
-   Produk harus memiliki kategori yang valid.
-   Harga tidak boleh negatif.
-   `stock_quantity` tidak boleh negatif.
-   Produk yang memiliki riwayat transaksi tidak boleh dihapus secara
    fisik.
-   Perubahan stok tidak dilakukan melalui endpoint edit produk.

### 6.2 Stock movement

-   `IN` menambah stok.
-   `OUT` mengurangi stok.
-   `ADJUSTMENT` menetapkan perubahan berdasarkan selisih terhadap stok
    aktual; definisi input harus disepakati secara konsisten.
-   Quantity harus lebih besar dari nol.
-   Stock movement harus mencatat user, produk, jenis, jumlah, waktu,
    dan referensi bila tersedia.
-   Update saldo produk dan insert movement harus berada dalam satu
    transaksi database.
-   Gunakan row locking (`SELECT ... FOR UPDATE`) atau strategi
    concurrency-safe yang setara untuk mencegah dua transaksi stok
    keluar membaca saldo yang sama.
-   Terapkan idempotency atau unique reference number agar request yang
    diulang tidak menggandakan transaksi.

### 6.3 Roles

  Action                         ADMIN                 STAFF
  ---------------------------- ------- ---------------------
  View dashboard                   Yes                   Yes
  View products/categories         Yes                   Yes
  Create/update products           Yes   According to policy
  Delete products/categories       Yes                    No
  Stock in/out                     Yes                   Yes
  Manage users                     Yes                    No

Backend wajib memeriksa role pada setiap endpoint yang dilindungi.

------------------------------------------------------------------------

## 7. API contract

**Base path:** `/api/v1`\
**Content type:** `application/json`

### 7.1 Authentication

  Method   Endpoint         Description
  -------- ---------------- -------------------
  POST     `/auth/login`    Authenticate user
  GET      `/auth/me`       Current user
  POST     `/auth/logout`   End session

Login request:

``` json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

Rekomendasi: gunakan cookie session/token `HttpOnly`, `Secure` pada
HTTPS, dan `SameSite` yang sesuai. Jika menggunakan cookie,
implementasikan CSRF protection untuk state-changing requests. Jangan
menyimpan signing secret pada frontend.

### 7.2 Products

  Method   Endpoint          Description
  -------- ----------------- ----------------------
  GET      `/products`       List with pagination
  GET      `/products/:id`   Product detail
  POST     `/products`       Create product
  PUT      `/products/:id`   Update product
  DELETE   `/products/:id`   Delete if permitted

Create product request:

``` json
{
  "category_id": 1,
  "sku": "PRD-001",
  "name": "Laptop ASUS",
  "description": "Laptop untuk kebutuhan kantor",
  "purchase_price": 7500000,
  "selling_price": 8500000,
  "minimum_stock": 5
}
```

Jangan menerima `stock_quantity` dari create/update product sebagai cara
mengubah stok. Gunakan stock movement.

### 7.3 Categories

  Method   Endpoint            Description
  -------- ------------------- ------------------------
  GET      `/categories`       List categories
  GET      `/categories/:id`   Category detail
  POST     `/categories`       Create category
  PUT      `/categories/:id`   Update category
  DELETE   `/categories/:id`   Delete unused category

### 7.4 Stock

  Method   Endpoint              Description
  -------- --------------------- ------------------
  GET      `/stock/movements`    Movement history
  POST     `/stock/in`           Stock-in
  POST     `/stock/out`          Stock-out
  POST     `/stock/adjustment`   Stock adjustment

Stock-in request:

``` json
{
  "product_id": 1,
  "quantity": 20,
  "reference_number": "IN-2026-001",
  "notes": "Pembelian supplier"
}
```

Stock-out request:

``` json
{
  "product_id": 1,
  "quantity": 5,
  "reference_number": "OUT-2026-001",
  "notes": "Pengeluaran barang"
}
```

### 7.5 Dashboard

  Method   Endpoint                        Description
  -------- ------------------------------- --------------------
  GET      `/dashboard/summary`            Inventory summary
  GET      `/dashboard/low-stock`          Low-stock products
  GET      `/dashboard/recent-movements`   Recent movements

### 7.6 Health checks

  Method   Endpoint                 Purpose
  -------- ------------------------ --------------------------------
  GET      `/api/v1/health/live`    Process is alive
  GET      `/api/v1/health/ready`   Application can serve requests

Liveness tidak perlu bergantung pada database. Readiness dapat memeriksa
konektivitas database dengan timeout singkat agar Pod tidak menerima
trafik ketika dependency utama belum siap.

### 7.7 Standard response

Success:

``` json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": "1",
    "sku": "PRD-001",
    "name": "Laptop ASUS",
    "stock_quantity": 0
  }
}
```

Error:

``` json
{
  "success": false,
  "message": "Insufficient stock",
  "errors": null
}
```

Status codes:

  Status   Meaning
  -------- -----------------------
  200      OK
  201      Created
  400      Validation error
  401      Unauthenticated
  403      Forbidden
  404      Not found
  409      Conflict
  500      Internal server error

Gunakan serialisasi BigInt ke string sebelum mengirim JSON karena
JavaScript `JSON.stringify` tidak dapat langsung memproses nilai
`BigInt`.

------------------------------------------------------------------------

## 8. Environment configuration

File `.env.example`:

``` env
NODE_ENV=development
PORT=5000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=inventory_db
DB_USER=inventory_user
DB_PASSWORD=CHANGE_ME

DATABASE_URL="mysql://inventory_user:CHANGE_ME@127.0.0.1:3306/inventory_db"

JWT_SECRET=CHANGE_ME
DB_POOL_LIMIT=10
```

Di GKE, `DB_HOST` diarahkan ke `127.0.0.1` karena Cloud SQL Auth Proxy
berjalan sebagai sidecar pada Pod yang sama.

Jangan commit `.env`, password, JWT secret, atau private key. Gunakan
Kubernetes Secret atau integrasi Google Secret Manager.

------------------------------------------------------------------------

## 9. Express implementation conventions

### 9.1 Application structure

-   `routes`: deklarasi endpoint dan middleware.
-   `controllers`: menerima request dan membentuk response.
-   `services`: business logic.
-   `config`: konfigurasi aplikasi dan database.
-   `middlewares`: authentication, authorization, validation, dan error
    handling.
-   `validators`: schema validasi input.

### 9.2 Database client

`src/config/database.js`:

``` javascript
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

module.exports = prisma;
```

Buat satu PrismaClient untuk satu proses aplikasi. Tutup koneksi secara
graceful saat proses dihentikan.

### 9.3 Stock transaction example

Contoh pola konseptual stock-out dengan Prisma:

``` javascript
async function stockOut({
  productId,
  userId,
  quantity,
  referenceNumber,
  notes,
}) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, stock_quantity
      FROM products
      WHERE id = ${BigInt(productId)}
      FOR UPDATE
    `;

    const product = rows[0];

    if (!product) {
      throw new Error("Product not found");
    }

    if (Number(product.stock_quantity) < quantity) {
      throw new Error("Insufficient stock");
    }

    const updated = await tx.product.update({
      where: { id: BigInt(productId) },
      data: {
        stockQuantity: {
          decrement: quantity,
        },
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: BigInt(productId),
        userId: BigInt(userId),
        type: "OUT",
        quantity,
        referenceNumber,
        notes,
      },
    });

    return { product: updated, movement };
  });
}
```

Tambahkan validasi idempotency/reference number, penanganan unique
constraint, timeout, dan mapping error yang aman. Gunakan isolasi
transaksi dan pola locking yang telah diuji terhadap versi Prisma/MySQL
yang dipakai.

------------------------------------------------------------------------

## 10. Docker configuration

### 10.1 package scripts

Contoh:

``` json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy"
  }
}
```

### 10.2 Dockerfile

``` dockerfile
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
```

Pastikan Prisma CLI tersedia pada tahap image build. Jika Prisma CLI
berada di devDependencies, generate dilakukan pada build stage yang
memiliki devDependencies, lalu salin hasil generated client ke runtime
image. Alternatifnya, atur multi-stage build khusus Prisma agar image
runtime tidak perlu membawa seluruh development toolchain.

`.dockerignore`:

``` text
node_modules
.git
.env
.env.*
!.env.example
coverage
npm-debug.log
```

Build lokal:

``` bash
docker build -t inventory-backend:local .
docker run --rm -p 5000:5000 --env-file .env inventory-backend:local
```

------------------------------------------------------------------------

## 11. Google Cloud SQL integration

### 11.1 Cloud SQL instance

  Setting    Value
  ---------- -------------------
  Engine     MySQL 8.0
  Instance   `inventory-mysql`
  Region     `asia-southeast2`
  Database   `inventory_db`
  User       `inventory_user`

Buat database dan user melalui Cloud SQL. Jangan gunakan root database
user untuk koneksi aplikasi.

### 11.2 Cloud SQL Auth Proxy

Cloud SQL Auth Proxy dijalankan sebagai sidecar pada backend Pod.

Contoh argument:

``` text
--structured-logs
--port=3306
PROJECT_ID:asia-southeast2:inventory-mysql
```

Proxy membuka listener lokal pada Pod. Backend memakai `127.0.0.1:3306`.

Proxy memberikan autentikasi dan enkripsi koneksi, tetapi tidak
menggantikan pengaturan database user dan privilege MySQL. Gunakan versi
proxy 2.x yang telah diverifikasi dan pin image tag/digest.

### 11.3 Workload Identity

Buat Google Service Account khusus, misalnya:

``` text
inventory-cloudsql@PROJECT_ID.iam.gserviceaccount.com
```

Berikan role minimum:

``` text
roles/cloudsql.client
```

Hubungkan Kubernetes Service Account `inventory-backend-ksa` pada
namespace `inventory-system` ke Google Service Account menggunakan
Workload Identity Federation for GKE.

Jangan membuat dan menyimpan JSON key service account untuk backend Pod.

------------------------------------------------------------------------

## 12. Kubernetes manifests

Namespace: `inventory-system`

Resources:

  Resource                     Name
  ---------------------------- -------------------------
  Deployment                   `inventory-backend`
  Service                      `backend-service`
  Kubernetes Service Account   `inventory-backend-ksa`
  ConfigMap                    `inventory-config`
  Secret                       `inventory-secrets`

### 12.1 Service Account

`k8s/service-account.yaml`:

``` yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: inventory-backend-ksa
  namespace: inventory-system
  annotations:
    iam.gke.io/gcp-service-account: inventory-cloudsql@PROJECT_ID.iam.gserviceaccount.com
```

### 12.2 ConfigMap

`k8s/configmap.yaml`:

``` yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: inventory-config
  namespace: inventory-system
data:
  NODE_ENV: "production"
  PORT: "5000"
  DB_HOST: "127.0.0.1"
  DB_PORT: "3306"
  DB_NAME: "inventory_db"
  DB_POOL_LIMIT: "10"
```

### 12.3 Backend Deployment and Service

`k8s/backend.yaml`:

``` yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inventory-backend
  namespace: inventory-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: inventory-backend
  template:
    metadata:
      labels:
        app: inventory-backend
    spec:
      serviceAccountName: inventory-backend-ksa
      containers:
        - name: backend
          image: DOCKERHUB_USERNAME/inventory-backend:IMAGE_TAG
          ports:
            - name: http
              containerPort: 5000
          envFrom:
            - configMapRef:
                name: inventory-config
          env:
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: inventory-secrets
                  key: DB_USER
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: inventory-secrets
                  key: DB_PASSWORD
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: inventory-secrets
                  key: JWT_SECRET
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: inventory-secrets
                  key: DATABASE_URL
          readinessProbe:
            httpGet:
              path: /api/v1/health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/v1/health/live
              port: http
            initialDelaySeconds: 20
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi

        - name: cloud-sql-proxy
          image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.1
          args:
            - "--structured-logs"
            - "--port=3306"
            - "PROJECT_ID:asia-southeast2:inventory-mysql"
          securityContext:
            runAsNonRoot: true
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: inventory-system
spec:
  type: ClusterIP
  selector:
    app: inventory-backend
  ports:
    - name: http
      port: 5000
      targetPort: http
```

Untuk lab, satu replica backend dapat digunakan terlebih dahulu. Naikkan
ke dua replica setelah resource cluster dan database connection pool
diperhitungkan.

Cloud SQL Auth Proxy sidecar menggunakan identity Pod. Backend dan proxy
berada pada network namespace yang sama sehingga backend dapat mengakses
proxy lewat localhost.

### 12.4 Secret

Contoh pembuatan secret:

``` bash
kubectl create secret generic inventory-secrets \
  --namespace=inventory-system \
  --from-literal=DB_USER=inventory_user \
  --from-literal=DB_PASSWORD='CHANGE_ME' \
  --from-literal=JWT_SECRET='CHANGE_ME' \
  --from-literal=DATABASE_URL='mysql://inventory_user:CHANGE_ME@127.0.0.1:3306/inventory_db'
```

Untuk production, gunakan Google Secret Manager dengan integrasi yang
sesuai. Hindari password pada shell history dan pastikan secret tidak
masuk ke Git.

Catatan: URL database harus di-encode dengan benar jika password
mengandung karakter khusus. Alternatif yang lebih aman adalah membentuk
koneksi dari field environment terpisah menggunakan konfigurasi Prisma
yang kompatibel dengan versi yang digunakan.

------------------------------------------------------------------------

## 13. Database migration strategy

Gunakan Prisma Migrate.

Development:

``` bash
npx prisma migrate dev --name init
```

Deployment:

``` bash
npx prisma migrate deploy
```

Status:

``` bash
npx prisma migrate status
```

Migration harus dijalankan satu kali per release, bukan oleh setiap
replica aplikasi saat startup.

Strategi yang disarankan:

1.  Build dan test backend image.
2.  Jalankan migration sebagai release task atau Kubernetes Job dengan
    akses Cloud SQL.
3.  Pastikan migration berhasil.
4.  Deploy backend image baru.
5.  Tunggu readiness dan rollout selesai.
6.  Jika rollout gagal, rollback aplikasi dengan memperhatikan
    kompatibilitas schema.

Gunakan pola expand-and-contract untuk perubahan schema yang tidak
kompatibel. Backup database sebelum migration berisiko.

------------------------------------------------------------------------

## 14. Jenkins CI/CD

Backend mempunyai pipeline sendiri di repository `inventory-backend`.

### 14.1 Pipeline stages

1.  Checkout GitHub.
2.  Install dependencies.
3.  Generate Prisma Client.
4.  Jalankan unit test.
5.  Jalankan integration test pada database test.
6.  Build Docker image dengan Git SHA.
7.  Push image ke Docker Hub.
8.  Autentikasi ke GKE.
9.  Jalankan migration release task.
10. Update backend Deployment.
11. Tunggu rollout selesai.

### 14.2 Jenkins credentials and identity

  Credential / Identity          Purpose
  ------------------------------ ---------------------------------
  `dockerhub-credentials`        Push image
  `github-credentials`           Checkout private repo
  Jenkins VM service account     Access GKE API sesuai kebutuhan
  GKE workload service account   Backend access to Cloud SQL

Jangan menggunakan satu service account ber-role Owner untuk semua
komponen. Pisahkan identitas Jenkins dan backend workload.

### 14.3 Jenkinsfile baseline

File `Jenkinsfile`:

``` groovy
pipeline {
    agent any

    environment {
        IMAGE_NAME = "DOCKERHUB_USERNAME/inventory-backend"
        GCP_PROJECT = "PROJECT_ID"
        GKE_CLUSTER = "inventory-cluster"
        GKE_REGION = "asia-southeast2"
        NAMESPACE = "inventory-system"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
                sh 'npx prisma generate'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Image') {
            steps {
                script {
                    env.IMAGE_TAG = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                }
                sh 'docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .'
            }
        }

        stage('Push Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh '''
                        set +x
                        echo "$DOCKER_PASS" |
                          docker login -u "$DOCKER_USER" --password-stdin
                    '''
                    sh 'docker push ${IMAGE_NAME}:${IMAGE_TAG}'
                    sh 'docker logout'
                }
            }
        }

        stage('Configure GKE') {
            steps {
                sh '''
                    gcloud container clusters get-credentials \
                      "$GKE_CLUSTER" \
                      --region="$GKE_REGION" \
                      --project="$GCP_PROJECT"
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sh '''
                    kubectl set image \
                      deployment/inventory-backend \
                      backend="$IMAGE_NAME:$IMAGE_TAG" \
                      -n "$NAMESPACE"

                    kubectl rollout status \
                      deployment/inventory-backend \
                      -n "$NAMESPACE" \
                      --timeout=180s
                '''
            }
        }
    }

    post {
        success {
            echo 'Backend pipeline completed successfully.'
        }
        failure {
            echo 'Backend pipeline failed.'
        }
    }
}
```

**Important:** Jenkinsfile di atas adalah baseline build/push/deploy.
Tahap migration production perlu ditambahkan sebagai stage terpisah
setelah dibuatkan migration Job dan mekanisme release yang aman. Jangan
menjalankan migration otomatis sebelum mekanisme tersebut diuji.

------------------------------------------------------------------------

## 15. Testing strategy

### 15.1 Unit tests

-   Product validation.
-   Category validation.
-   Authentication service.
-   Role authorization.
-   Stock calculation.
-   Low-stock calculation.

### 15.2 Integration tests

-   Login dengan user valid dan invalid.
-   CRUD produk.
-   CRUD kategori.
-   Stock-in transaction.
-   Stock-out transaction.
-   Insufficient stock rejection.
-   Duplicate SKU rejection.
-   Duplicate reference number rejection.
-   Concurrent stock-out requests.
-   Database rollback saat transaksi gagal.

### 15.3 Security tests

-   Endpoint protected tanpa session.
-   STAFF mengakses endpoint ADMIN.
-   Input invalid dan oversized payload.
-   SQL injection attempts.
-   Brute-force/rate limiting.
-   Secret tidak tampil pada log.
-   Password tidak dikembalikan dalam API response.

------------------------------------------------------------------------

## 16. Observability and operations

Perintah pemeriksaan:

``` bash
kubectl get pods -n inventory-system
kubectl get deployment -n inventory-system
kubectl get service -n inventory-system
kubectl get events -n inventory-system \
  --sort-by=.metadata.creationTimestamp
```

Log backend:

``` bash
kubectl logs deployment/inventory-backend \
  -n inventory-system -c backend
```

Log Cloud SQL Auth Proxy:

``` bash
kubectl logs deployment/inventory-backend \
  -n inventory-system -c cloud-sql-proxy
```

Rollback aplikasi:

``` bash
kubectl rollout undo deployment/inventory-backend \
  -n inventory-system
```

Pantau jumlah koneksi database, query latency, error rate, CPU/memory
Pod, serta Cloud SQL storage dan backup.

------------------------------------------------------------------------

## 17. Acceptance criteria

-   [ ] Express server berjalan di port 5000.
-   [ ] Health live dan ready endpoint tersedia.
-   [ ] Prisma berhasil terhubung ke MySQL.
-   [ ] Migration berhasil diterapkan.
-   [ ] Authentication dan role authorization berfungsi.
-   [ ] CRUD produk dan kategori berfungsi.
-   [ ] Stock-in dan stock-out transaksional.
-   [ ] Stok tidak dapat menjadi negatif.
-   [ ] Riwayat movement konsisten dengan perubahan saldo.
-   [ ] Unit dan integration tests lulus.
-   [ ] Docker image berhasil dibuat dan dijalankan.
-   [ ] Backend dapat mengakses Cloud SQL melalui Auth Proxy.
-   [ ] Workload Identity berfungsi tanpa service account key file.
-   [ ] Backend hanya diekspos melalui ClusterIP.
-   [ ] Jenkins berhasil push image dan deploy ke GKE.
-   [ ] Tidak ada credential dalam repository atau image.

------------------------------------------------------------------------

## 18. Implementation order

1.  Bootstrap repository `inventory-backend`.
2.  Buat Express app, middleware, routes, dan health endpoints.
3.  Implementasikan Prisma schema.
4.  Buat migration dan seed awal untuk kategori serta admin.
5.  Implementasikan authentication dan authorization.
6.  Implementasikan category dan product modules.
7.  Implementasikan stock movement dengan transaction dan concurrency
    control.
8.  Buat unit dan integration tests.
9.  Jalankan backend dengan MySQL lokal.
10. Buat Cloud SQL instance dan uji koneksi melalui Auth Proxy.
11. Buat Docker image.
12. Deploy backend ke GKE.
13. Integrasikan Jenkins pipeline.
14. Hubungkan frontend Next.js ke API backend.

**Prinsip utama:** backend menjadi satu-satunya pemilik business logic
dan akses database. Seluruh perubahan saldo stok wajib dilakukan melalui
service transaksi yang menjaga konsistensi data.
