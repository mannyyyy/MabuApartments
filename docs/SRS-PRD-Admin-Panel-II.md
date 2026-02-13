# MABU APARTMENTS - ADMIN PANEL SRS & PRD II

## Software Requirements Specification (SRS) + Product Requirements Document (PRD)

---

## EXECUTIVE SUMMARY

**Project**: Mabu Apartments Admin Panel and Backend System
**Version**: 2.0
**Document Type**: SRS + PRD (single source of truth)
**Last Updated**: February 2, 2026
**Status**: Draft - Ready for Review

### Purpose

This document defines the functional and non-functional requirements for a production-grade admin panel and backend system for Mabu Apartments. It replaces prior documents and is the authoritative source for v1 scope.

### Key Business Goals 

1. Streamline booking operations with minimal manual steps.
2. Prevent overbooking using per-room availability with holds and expiry.
3. Enforce document verification prior to confirmation.
4. Secure operations via RBAC, audit logs, and private document handling.
5. Enable marketing content management via Sanity CMS.
6. Provide essential operational visibility (bookings by status, revenue totals, occupancy rate, cancellations, upcoming check-ins/outs).

Advanced analytics and staff performance visibility are deferred to v2.
V1 scope now includes a 5-bedroom Mabu Court apartment with selectable bedrooms (2-5) and partial-access rules.

### Core Decisions (v1)

1. **Booking Allocation**: Guests select **room type**, system assigns a **specific room** at booking creation based on availability.
2. **Room Reassignment**: Admins may reassign a booking **before `CONFIRMED`**, **same room type only**, with an audit reason.
3. **Availability Model**: Per-room, per-night availability with explicit holds.
4. **Property Model**: Room types belong to a Property; Property holds address/location data.
5. **Multi-Bedroom Unit (Mabu Court)**: Single unit inventory; booking selects 2-5 bedrooms; unused bedrooms locked; common areas accessible.
6. **Hold TTL**: Payment hold is a fixed 15 minutes.
7. **Timezone**: All SLAs, holds, and availability rules use a global timezone (Africa/Lagos) for all properties.
8. **Verification SLA**: After payment verification, `verificationDueAt = now + 24h` (configurable to 12h). If overdue, auto-cancel and release holds.
9. **Document Rules**: Max 4 documents per booking: required `OFFICIAL_ID_FRONT`, `OFFICIAL_ID_BACK`; optional `PAYMENT_EVIDENCE`; optional `ADDITIONAL_DOCUMENT` (max 1). Admin-requested documents are exempt from the 4-file limit.
10. **Booking Status**: No `PAID` status. Use `PENDING_PAYMENT` and `PAID_PENDING_VERIFICATION`.
11. **Retention Policy**: `closedAt` set when status becomes REJECTED or CANCELLED. Retention is `closedAt + N days`. Confirmed stays use `checkOut + 90 days`.
12. **Auth Policy**: Access token 15m, refresh token 7-30 days. Inactivity timeout enforced by server using sliding idle window and refresh revocation.
13. **Upgrades/Downgrades**: Guest-initiated room type upgrades/downgrades are out of scope for v1.

### Current Inventory (for v1 allocation)

- Property: Mabu Apartments - Wuse II
- Address: 5, Awande Close, Behind LG Show Room, Off Aminu Kano Crescent, Wuse II, Abuja, Nigeria
- Studio Apartment: 2 rooms
- One Bedroom Apartment: 6 rooms
- Two Bedroom Apartment: 1 room
- Property: Mabu Court - Gwarinpa
- Address: Mabu Court, Flat 4, 1 Enuwa Ebele Street, backing Ahmadu Bello Way, beside Market Square supermarket, Gwarinpa, Abuja, Nigeria
- Mabu Court 5 Bedroom Apartment: 1 unit

Given small inventory and per-room availability requirements, v1 uses **room assignment at booking creation** rather than pooled room-type inventory.

---

## TABLE OF CONTENTS

1. System Overview
2. Functional Requirements
3. Data Model (Conceptual)
4. API Specifications
5. Roles and RBAC
6. Sanity CMS Integration
7. Non-Functional Requirements
8. Security and Compliance
9. User Stories and Workflows
10. Implementation Roadmap
11. Wireframe/Mockup Descriptions
12. V2 + Nice-to-Haves

---

## 1. SYSTEM OVERVIEW

### 1.1 System Boundaries

| Component             | Included | Description
| --------------------- | -------- | ----------------------------------------------
| Public Website        | Yes      | Guest booking form, room listings, content
| Admin Panel           | Yes      | Booking, rooms, availability, users, analytics
| Backend API           | Yes      | Business logic, payment, documents, auth
| Database              | Yes      | Prisma + PostgreSQL
| Sanity CMS            | Yes      | Marketing content management
| File Storage          | Yes      | S3 or Cloudinary (private)
| Lead Management       | No       | WhatsApp/Email only

### 1.2 Integration Points

| External System       | Purpose                         | Integration Type
| --------------------- | ------------------------------- | ----------------
| Paystack              | Payment processing              | Webhook + API
| Sanity CMS            | Content delivery                | API client
| AWS S3 or Cloudinary  | Document storage                | Signed URLs
| SendGrid or Mailgun   | Transactional email             | SMTP/API
| WhatsApp              | Guest communication             | wa.me links (v1)

### 1.3 Key Design Principles

1. Single booking model with status-based pipeline.
2. Night-based availability (check-in inclusive, check-out exclusive).
3. Temporary holds with explicit expiry and release rules.
4. Required document verification before confirmation.
5. Separation of concerns: operational data in DB, marketing in Sanity.
6. Global time (Africa/Lagos) governs all business rules and SLAs.
7. Security first: RBAC, audit logs, signed URLs, validation.

---

## 2. FUNCTIONAL REQUIREMENTS

### 2.1 Booking Management

#### FR-1.1: Booking Creation

- **Requirement**: Guests can submit booking requests via the website.
- **Input Fields**:
  - Guest name (first, last)
  - Guest email
  - Guest phone number
  - Check-in date
  - Check-out date
  - Room type selection
  - Bedrooms selected (for multi-bedroom units; min 2, max 5)
  - Number of guests
  - Documents (see FR-4)
  - Terms and conditions acceptance
- **Validation**:
  - Required fields
  - Date validity and logical range
  - Same-day bookings allowed (no cutoff)
  - Capacity check by room type
  - Availability check per room
  - If room type has `minBedrooms/maxBedrooms`, require `bedroomsSelected` within range
  - Document validation rules
  - Required documents must be uploaded before payment submission
- **Allocation**:
  - System assigns a specific room at booking creation.
  - Allocation strategy (v1): first available by room number.
- **Initial Status**: `PENDING_PAYMENT`
- **Hold**: Create availability holds for assigned room for 15 minutes.
- **Output**: Booking ID and Paystack redirect URL.

#### FR-1.2: Payment Processing (Paystack)

- **Requirement**: Integrate Paystack for payment collection.
- **Flow**:
  1. Guest redirected to Paystack with booking metadata
  2. Paystack webhook sent on success
  3. Backend verifies signature
  4. Booking status -> `PAID_PENDING_VERIFICATION`
  5. `verificationDueAt` set to now + 24h (configurable 12h)
- **Retry**: Allow up to 3 payment attempts via PaymentAttempt records.
- **Webhook Verification**: HMAC validation required, de-duplicate by `paystackReference`.
- **Late Payment**: If payment succeeds after hold expiry, reassign another room of the same room type if available; otherwise cancel and refund/manual review.

#### FR-1.3: Admin Booking Approval

- **Requirement**: Admins can review and approve bookings.
- **Pre-Approval Checks**:
  - Verify required ID documents
  - Verify guest details completeness
  - Confirm no duplicate bookings for same guest and date range
- **Actions**:
  - Approve: status -> `CONFIRMED`, keep availability blocked
  - Reject: status -> `REJECTED`, set `closedAt`, release holds, require reason and notify guest
  - Request more info: remain `PAID_PENDING_VERIFICATION`, allow additional document upload
  - Reassign room: allowed before `CONFIRMED`, same room type only, require reason
- **Audit**: Log all actions with admin ID, timestamp, reason.

#### FR-1.4: Booking Cancellation

- **Requirement**: Guests or admins can cancel bookings.
- **Rules**:
  - Guest can cancel before `CONFIRMED`.
  - Admin can cancel at any stage.
  - If paid: refund handled manually (v1).
- **Effects**:
  - status -> `CANCELLED`
  - set `closedAt`
  - release holds/blocks
  - require reason and send email notification
  - audit log entry

#### FR-1.5: Manual Booking Creation (Admin)

- **Requirement**: Admins can create bookings for walk-ins/WhatsApp.
- **Flow**:
  - Admin fills booking form.
  - `BookingSource.ADMIN` is set.
  - Availability and allocation rules apply.
  - Status set to `PENDING_PAYMENT` or `PAID_PENDING_VERIFICATION` if payment captured offline.
- **Audit**: Log creation, payment method, and changes.

#### FR-1.6: Booking Extension

- **Requirement**: Extend an existing booking by one or more nights.
- **Flow**:
  - Admin selects booking and new check-out date.
  - System checks availability for the same room for added nights.
  - If available: generate Paystack link for additional amount.
  - After payment: update check-out date, extend holds.
  - If unavailable: deny extension.
- **Audit**: Log extension attempt and outcome.

#### FR-1.7: Verification Overdue Handling

- **Requirement**: Enforce verification SLA after payment.
- **Rule**:
  - If `verificationDueAt` passes and booking still `PAID_PENDING_VERIFICATION`, system auto-cancels.
  - status -> `CANCELLED`
  - set `closedAt`
  - release holds
  - optional email notification

### 2.2 Room and Inventory Management

#### FR-2.1: Property CRUD

- **Requirement**: Admins manage properties (locations).
- **Fields**:
  - Name
  - Address line 1
  - Area
  - City
  - Landmark
  - Country
- **Validation**: Required fields, unique property name.
- **Audit**: Log changes to property.

#### FR-2.2: Room Type CRUD

- **Requirement**: Admins manage room types.
- **Fields**:
  - Name, slug, description
  - Property association (`propertyId`)
  - Capacity
  - Bedrooms, bathrooms
  - Min bedrooms, max bedrooms (for selectable-bedroom units)
  - Bedroom pricing tiers (2-5) (values TBD)
  - Access scope rule (e.g., selected bedrooms + common areas)
  - Base price
  - Amenities (TBD for Mabu Court)
  - Images (multiple)
  - Status (Draft/Published/Archived)
  - Featured flag
- **Validation**: Required fields, positive price, valid image formats. If `minBedrooms/maxBedrooms` set, require bedroom pricing tiers and access scope rule.
- **Audit**: Log changes to room type.

#### FR-2.3: Room CRUD

- **Requirement**: Admins manage individual rooms.
- **Fields**:
  - Room number
  - Room type association
  - Status (Active/Inactive)
- **Rule**: Room count is derived from room records, not stored.

#### FR-2.4: Image Management

- **Requirement**: Upload, reorder, delete room images.
- **Constraints**:
  - Max 10 images per room type
  - JPG, PNG, WebP
  - Max 5MB per image

#### FR-2.5: Pricing Management

- **Requirement**: Base and override pricing.
- **Features**:
  - Base price per room type
  - Tiered pricing by bedrooms selected for multi-bedroom units (2-5 tiers; values TBD)
  - Seasonal overrides
  - Holiday or weekend surcharges (optional)
  - Per-date overrides
- **Validation**: Non-overlapping date ranges.

### 2.3 Availability Management

#### FR-3.1: Availability Blocking

- **Requirement**: Prevent double-booking using per-room holds.
- **Rule**: Single-unit room types (e.g., Mabu Court 5 Bedroom Apartment) have only one room record; any active hold blocks all concurrent bookings.
- **Holds**:
  - `PENDING_PAYMENT`: hold with TTL 15 minutes
  - `PAID_PENDING_VERIFICATION`: hold until `verificationDueAt`
  - `CONFIRMED`: permanent block
- **Release Rules**:
  - payment failure or cancellation: release immediately
  - rejection: release immediately
  - hold expiration: auto release
  - late payment: follow FR-1.2 late-payment reassignment rule

#### FR-3.2: Manual Availability Overrides

- **Requirement**: Admins can block/unblock dates for maintenance.
- **Features**:
  - Block specific rooms or all rooms in a room type
  - Provide reason
  - Audit log entry

#### FR-3.3: Bulk Operations (v2)

- Bulk price updates and bulk availability are deferred.

### 2.4 Document Management

#### FR-4.1: Document Upload

- **Required**: `OFFICIAL_ID_FRONT`, `OFFICIAL_ID_BACK`
- **Optional**: `PAYMENT_EVIDENCE`
- **Optional**: `ADDITIONAL_DOCUMENT` (max 1 unless admin requests more)
- **Max Files (v1)**: 4 per booking (excluding admin-requested additional docs)
- **Timing (v1)**: Required documents must be uploaded before payment submission
- **Formats**: PDF, JPG, PNG
- **Size**: Max 5MB per file
- **Storage**: Private S3/Cloudinary bucket
- **Access**: Signed URLs, admin-only

#### FR-4.2: Document Retrieval

- **Requirement**: Admins can view/download documents via signed URLs.
- **Security**:
  - Signed URL expiration: 15 minutes
  - Audit every view

#### FR-4.3: Document Retention

- **Rejected or Cancelled**: Delete at `closedAt + N days` (N default 7, configurable)
- **Confirmed**: Delete at `checkOut + 90 days`
- **Manual Override**: Admin can delete earlier, with audit log
- **Storage Enforcement**: Configure storage lifecycle rules to align with retention policy

### 2.5 Guest Management

#### FR-5.1: Guest Profile

- **Fields**: Name, email, phone, number of bookings, last booking date, notes
- **Auto creation** on first booking
- **Searchable** by email or phone

#### FR-5.2: Guest Booking History

- View all bookings for a guest, with status, dates, and room type

### 2.6 Authentication and RBAC

#### FR-6.1: Admin Authentication

- Email/password login
- Password policy: min 8 chars, uppercase, number, special char
- Access token: 15 minutes
- Refresh token: 7-30 days
- Idle timeout: server-enforced sliding window with refresh revocation
- Login rate limiting: 5 attempts per 15 minutes

#### FR-6.2: Role-Based Access Control

- Roles: Super Admin, Property Manager, Support Agent, Content Editor
- Enforcement at API, server actions, and UI

#### FR-6.3: User Management (Super Admin)

- Create, update, deactivate admin users
- Assign roles
- Reset passwords
- View last login activity

### 2.7 Audit Logging

- Log all sensitive actions: booking, payment, availability, document, user changes
- Fields: admin ID, action, timestamp, IP, details, reason
- Retention: 1 year (configurable)
- Immutability: audit logs cannot be edited or deleted
- Access: view/export restricted to Super Admin

### 2.8 Analytics (v1)

- **Dashboard Metrics (v1)**:
  - Bookings by status (by date range)
  - Revenue totals (by date range)
  - Occupancy rate (by date range)
  - Cancellations count
  - Upcoming check-ins/outs (next 7 days, configurable window)
- **Data Sources**: Bookings, Payments, Availability
- **Advanced Analytics**: Staff performance and advanced reporting deferred to v2

### 2.9 Notifications

- Transactional emails:
  - Payment received
  - Booking confirmed
  - Booking rejected
  - Booking cancelled
  - Booking extended
  - Document request
- Rejection/cancellation emails include the admin-provided reason
- WhatsApp quick links (wa.me)

---

## 3. DATA MODEL (CONCEPTUAL)

### 3.1 Core Entities

- **Property**: name, addressLine1, area, city, landmark, country
- **RoomType**: name, slug, basePrice, capacity, amenities, status, propertyId, minBedrooms, maxBedrooms, bedroomPricingTiers, accessScopeRule
- **Room**: roomNumber, roomTypeId, status
- **Availability**: roomId, date, isAvailable, holdUntil, holdBookingId
- **Booking**:
  - guestId, roomId, roomTypeId
  - checkIn, checkOut, numberOfGuests
  - bedroomsSelected (nullable; required for selectable-bedroom units)
  - status, source, verificationDueAt
  - closedAt (set on rejected/cancelled)
  - timestamps
- **Payment**: bookingId, status, amount, currency
- **PaymentAttempt**: paymentId, paystackReference, status, createdAt
- **Document**: bookingId, type, storageKey, bucket/provider, mimeType, size, checksum, uploadedBy, uploadedAt, expiresAt
- **Guest**: name, email, phone, stats
- **AdminUser**: role, auth fields, status
- **AuditLog**: action, entity, actor, details
- **SystemSettings**: key/value

**Timezone Note**: Business rules, SLAs, and availability calculations use global time (Africa/Lagos).

### 3.2 Booking Statuses

- `PENDING_PAYMENT`
- `PAID_PENDING_VERIFICATION`
- `CONFIRMED`
- `REJECTED`
- `CANCELLED`

### 3.3 Booking Sources

- `WEBSITE`
- `ADMIN`

### 3.4 Payment Statuses

- `INITIATED`
- `PENDING`
- `SUCCESS`
- `FAILED`
- `REFUNDED`
- `CHARGEBACK`

---

## 4. API SPECIFICATIONS (HIGH-LEVEL)

### Common Conventions

- **Auth**: Bearer access token required for admin endpoints.
- **Pagination**: `page`, `limit`, `sort` (e.g., `createdAt:desc`).
- **Standard Error Shape**:
  - `code`
  - `message`
  - `fieldErrors[]` (array of `{ field, message }`)
- **Idempotency**:
  - Booking creation requires `Idempotency-Key` header.
  - Paystack webhook processing de-duplicates by `paystackReference`.

### Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Properties

- `POST /api/properties/create`
- `GET /api/properties`
- `PUT /api/properties/:id`

### Booking

- `POST /api/bookings/create` (roomTypeId, dates, docs, bedroomsSelected when applicable, Idempotency-Key header)
- `POST /api/bookings/:id/approve`
- `POST /api/bookings/:id/reject`
- `POST /api/bookings/:id/cancel`
- `POST /api/bookings/:id/extend`
- `GET /api/bookings` (filters: status, dateFrom, dateTo, guestEmail, guestPhone, propertyId, roomTypeId, roomId, roomNumber, pagination)
- `GET /api/bookings/:id`

### Availability

- `GET /api/availability/check` (propertyId, roomTypeId, date range)
- `GET /api/availability/calendar` (propertyId, roomTypeId)
- `POST /api/availability/block`
- `POST /api/availability/unblock`

### Payment

- `POST /api/payments/create`
- `POST /api/payments/verify`
- `POST /api/payments/webhook`

### Documents

- `POST /api/documents/upload`
- `GET /api/documents/:id/view`
- `DELETE /api/documents/:id`

### Guests

- `GET /api/guests` (filters: name, email, phone, pagination)
- `GET /api/guests/:id/bookings`
- `PUT /api/guests/:id/notes`

### Admin Users

- `POST /api/admin/users/create`
- `PUT /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-password`

### Analytics

- `GET /api/analytics/overview` (dateFrom, dateTo, propertyId)
- Advanced analytics deferred to v2.

### Audit Logs

- `GET /api/audit-logs` (filters: actor, action, dateFrom, dateTo, pagination)
- `GET /api/audit-logs/export` (Super Admin only)

---

## 5. ROLES AND RBAC

| Feature                     | Super Admin | Property Manager | Support Agent | Content Editor
| --------------------------- | ----------- | ---------------- | ------------- | --------------
| Booking management          | Yes         | Yes              | Limited       | No
| Room management             | Yes         | Yes              | No            | Limited (content only)
| Pricing management          | Yes         | Yes              | No            | No
| Availability management     | Yes         | Yes              | View only     | No
| Documents                   | Yes         | Yes              | View only     | No
| Guest management            | Yes         | Yes              | Yes           | No
| Users/roles                 | Yes         | No               | No            | No
| Audit logs                  | Yes         | No               | No            | No
| Content (Sanity)            | Yes         | No               | No            | Yes

### Action-Level Permissions (v1)

| Action                               | Super Admin | Property Manager | Support Agent         | Content Editor
| ------------------------------------ | ----------- | ---------------- | --------------------- | --------------
| Approve booking                      | Yes         | Yes              | No                    | No
| Reject booking (reason required)     | Yes         | Yes              | No                    | No
| Cancel booking                       | Yes         | Yes              | Pre-confirm only      | No
| Reassign room (pre-confirm only)     | Yes         | Yes              | No                    | No
| Manual block/unblock availability    | Yes         | Yes              | No                    | No
| Create/edit pricing                  | Yes         | Yes              | No                    | No
| View/download documents              | Yes         | Yes              | View only             | No
| Delete documents                     | Yes         | No               | No                    | No
| Refund/chargeback handling           | Yes         | No               | No                    | No
| Manage admin users/roles             | Yes         | No               | No                    | No
| Export audit logs                    | Yes         | No               | No                    | No

---

## 6. SANITY CMS INTEGRATION

- Embedded Sanity Studio at `/admin/content`
- Content types: homepage, about, contact, FAQs, policies, testimonials, blog (optional)
- Public website fetches via `/api/content/:type` proxy
- Cache strategy: 1 hour CDN cache, optional webhook invalidation

---

## 7. NON-FUNCTIONAL REQUIREMENTS

### Performance

- Admin dashboard load < 2s
- API GET responses < 500ms (cached)
- Booking creation < 2s
- Document upload < 5s
- Search < 1s

### Scalability

- PostgreSQL with connection pooling
- S3/Cloudinary for files
- Serverless API (Vercel)
- Sanity CDN

### Availability Targets

- Admin panel: 99.5%
- API: 99.9%
- Website: 99.9%

### Backup and Recovery

- PostgreSQL daily backups (bookings, users, audit logs, document metadata)
- RPO: 24 hours
- RTO: 4 hours
- Document files rely on storage durability (S3/Cloudinary)

### Accessibility

- WCAG 2.1 AA
- Keyboard navigation
- Screen reader support

---

## 8. SECURITY AND COMPLIANCE

### Authentication

- bcrypt/Argon2 hashing
- 15m access token, 7-30 day refresh token
- Sliding idle timeout with revocation

### Authorization

- RBAC enforced in middleware and server actions
- Unauthorized access logged

### Data Security

- Zod validation
- CSP headers
- CSRF protection
- Private document storage with signed URLs
- Encryption at rest for PII and documents
- TLS in transit for all API and storage access
- Storage lifecycle rules to enforce retention policies

### Rate Limiting

- Login: 5 attempts per 15 minutes per IP
- Booking creation: 5 requests per minute per IP
- Availability check: 30 requests per minute per IP
- Document upload: 10 requests per minute per IP

### Privacy

- GDPR export and deletion requests
- Data minimization
- Consent checkbox for terms

---

## 9. USER STORIES AND WORKFLOWS

### Guest Booking Flow (v1)

1. Guest selects room type and dates.
2. If room type supports selectable bedrooms, guest selects 2-5 bedrooms.
3. System checks availability and assigns a specific room.
4. Guest uploads required documents and submits.
5. Booking created as `PENDING_PAYMENT` with a 15-minute hold.
6. Guest pays via Paystack.
7. On webhook verification, status -> `PAID_PENDING_VERIFICATION` and `verificationDueAt` set.
8. Admin approves or rejects.
9. If overdue, auto-cancel.

### Admin Booking Flow

1. Admin creates booking with source `ADMIN`.
2. Admin selects property and room type (property pre-filters available room types).
3. System assigns room and holds inventory.
4. If payment captured, status -> `PAID_PENDING_VERIFICATION`.
5. Admin approves to confirm.

### Verification Overdue

- If `verificationDueAt` is reached without action, auto-cancel and release holds.

### Acceptance Criteria (v1)

- **Booking Creation**: Required documents present; booking saved as `PENDING_PAYMENT` with 15-minute hold.
- **Selectable Bedrooms**: If room type requires `bedroomsSelected`, enforce 2-5 range and persist selection for pricing and access scope.
- **Payment/Webhook**: Successful webhook sets `PAID_PENDING_VERIFICATION` and `verificationDueAt`; duplicate webhooks are ignored.
- **Approval/Rejection**: Approve -> `CONFIRMED`; reject requires reason, notifies guest, releases holds, sets `closedAt`.
- **Cancellation**: Requires reason, notifies guest, releases holds/blocks, sets `closedAt`.
- **Late Payment**: If hold expired, reassign same room type if available; otherwise cancel and refund/manual review.
- **Documents**: Admin-requested extra documents may exceed 4-file limit; signed URLs expire after 15 minutes.

---

## 10. IMPLEMENTATION ROADMAP

### Phase 1: Foundation and Auth

- Database schema
- Authentication and RBAC
- Basic admin login

### Phase 2: Booking and Payment

- Booking create flow
- Paystack integration
- Document upload

### Phase 3: Admin Panel

- Booking list and detail
- Approval/rejection
- Document viewing
- Analytics overview metrics (bookings, revenue, occupancy, cancellations, upcoming check-ins/outs)

### Phase 4: Rooms and Availability

- Room/room type CRUD
- Calendar view
- Manual blocks

### Phase 5: Users and Audit

- Admin user management
- Audit log view

### Phase 6: Sanity

- Sanity setup
- Content proxy endpoints

### Phase 7: Testing and Release

- Unit, integration, E2E tests
- Performance and security review
- Production deployment

---

## 11. WIREFRAME / MOCKUP DESCRIPTIONS

- Dashboard: key metrics (bookings, revenue, occupancy, cancellations, upcoming check-ins/outs), recent bookings
- Booking list: filters, status chips
- Booking detail: guest info, room, documents, actions
- Rooms: list + create/edit
- Availability: calendar with block/unblock
- Users: admin management
- Audit logs: searchable table

---

## 12. V2 + Nice-to-Haves

### V2 Features

- Analytics dashboard (advanced reporting)
- Bulk pricing updates and bulk availability operations
- Automated refunds
- Guest upgrade/downgrade flow
- Staff performance visibility
- Reporting exports
- Multi-property support

### Nice-to-Haves

- In-app messaging / WhatsApp integration
- Automated ID verification
- Dynamic pricing rules
- Occupancy forecasting
- Waitlist
- Promo codes

---

## SUMMARY

This document defines the v1 scope and corrects prior inconsistencies. The system uses room-type selection with room-level allocation, strict verification SLA, clear document rules, minimal operational analytics, and modern session security. Advanced analytics and staff performance are deferred to v2. It is the authoritative source for implementation and refactoring.
