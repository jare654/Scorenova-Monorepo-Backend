# Learnova Backend – Frontend Registration & Authentication Integration Guide

This document is the official API guide for frontend developers building the mobile and web client authentication flow on the Learnova platform.

---

## Base API URL
```
http://<server-host>:<port>/api/v1
```
*(Example local URL: `http://localhost:8011/api/v1`)*

---

## 1. Registration Flow Overview (4 Steps)

```
┌─────────────────┐       ┌────────────────────┐       ┌────────────────────────┐       ┌───────────────────────────┐
│ Step 1: OTP Send│ ────> │ Step 2: Verify OTP │ ────> │ Step 3: User Details   │ ────> │ Step 4: Password & Active │
│ POST /otp/send  │       │ POST /verify-otp   │       │ POST /register-step-one│       │ POST /register-set-pass   │
└─────────────────┘       └────────────────────┘       └────────────────────────┘       └───────────────────────────┘
```

---

### Step 1: Send OTP Code
Initiates registration by generating an OTP code for the given phone number.

- **Route**: `POST /api/v1/auth/otp/send`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "phoneNumber": "0912345678"
  }
  ```
- **Response**: `HTTP 201 Created` / `HTTP 200 OK`
  ```json
  {
    "expiresAt": "2026-07-25T07:15:00.000Z"
  }
  ```

---

### Step 2: Verify OTP Code
Validates the 6-digit OTP code entered by the user.

- **Route**: `POST /api/v1/auth/verify-otp`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "phoneNumber": "0912345678",
    "otp": "123456"
  }
  ```
- **Response**: `HTTP 201 Created` / `HTTP 200 OK`
  ```json
  {
    "verified": true,
    "nextStep": "personal_details"
  }
  ```
  *(Note: If the user previously submitted profile details, `nextStep` will return `"set_password"`)*.

---

### Step 3: Register Personal Details
Saves student profile information directly into the `accounts` table with status `pending_password`.

- **Route**: `POST /api/v1/auth/register-step-one`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "phoneNumber": "0912345678",
    "fullName": "Abebe Bikila",
    "email": "abebe@example.com",
    "gender": "male",
    "gradeId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "streamId": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    "userType": "student"
  }
  ```
  *(Optional properties: `email`, `gender`, `gradeId`, `streamId`, `userType`)*.
- **Response**: `HTTP 201 Created` / `HTTP 200 OK`
  ```json
  {
    "success": true,
    "accountId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  }
  ```

---

### Step 4: Create Password & Complete Registration
Hashes the password, activates the account (`status: "active"`), and issues access and refresh tokens.

- **Route**: `POST /api/v1/auth/register-set-password`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "phoneNumber": "0912345678",
    "password": "Password123!",
    "confirmPassword": "Password123!"
  }
  ```
- **Response**: `HTTP 201 Created` / `HTTP 200 OK`
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "profile": {
      "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "name": "Abebe Bikila",
      "phoneNumber": "0912345678",
      "email": "abebe@example.com",
      "type": "student",
      "status": "active"
    }
  }
  ```

---

## 2. User Login & Incomplete Registration Handling (HTTP 423)

### Standard Login Endpoint
- **Route**: `POST /api/v1/auth/login`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "phoneNumber": "0912345678",
    "password": "Password123!",
    "loginAs": "student",
    "fcmId": "fcm_token_sample_xyz123"
  }
  ```

---

### Incomplete Registration Exception (HTTP Status 423 Locked)
If a user completed Step 3 (submitted personal details) but closed the app before completing Step 4 (setting a password), any login attempt will return **HTTP 423 (Locked)**:

- **HTTP Status Code**: `423 Locked`
- **Response Body**:
  ```json
  {
    "statusCode": 423,
    "message": "Registration is incomplete. Please set your password to complete registration.",
    "error": "Locked",
    "nextStep": "set_password"
  }
  ```

### 💡 Required Frontend Handling:
1. Intercept HTTP responses with status code `423`.
2. Navigate the user directly to the **Create Password Screen**.
3. Submit `POST /api/v1/auth/register-set-password` with the user's phone number and new password.

---

## 3. Supplementary Auth Endpoints Reference

| Endpoint | Method | Request Body | Description |
| :--- | :--- | :--- | :--- |
| `/auth/check-phone` | `POST` | `{"phoneNumber": "0912345678"}` | Check if a phone number is registered |
| `/auth/forgot-password` | `POST` | `{"phoneNumber": "0912345678"}` | Send OTP for password reset |
| `/auth/forgot-password-verify-otp` | `POST` | `{"phoneNumber": "0912345678", "otp": "654321"}` | Verify password reset OTP |
| `/auth/forgot-password-reset` | `POST` | `{"phoneNumber": "0912345678", "password": "...", "confirmPassword": "..."}` | Reset password with new value |
| `/auth/refresh` | `POST` | `{"refreshToken": "..."}` | Obtain new access & refresh tokens |
| `/auth/get-user-info` | `GET` | Header: `Authorization: Bearer <accessToken>` | Retrieve authenticated user profile |
