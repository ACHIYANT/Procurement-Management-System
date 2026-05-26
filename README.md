# Procurement Management System (PMS)

Procurement Management System (PMS) is a workflow-driven application for managing the complete procurement lifecycle in a structured, auditable, and role-controlled way.

It is designed to support procurement operations from indent initiation to tendering, committee workflow, negotiation, LOA/RC/PO issuance, EMD/PBG compliance, inspection, delivery, installation, invoicing, and approval movement.

## Core Objectives

- secure login and session handling
- role-based and workflow-based access control
- audit-friendly document and approval trails
- tender-centric procurement tracking
- vendor compliance management
- scalable frontend and backend service architecture

## Phase 1 Scope

The first implementation phase keeps **Tender** as the central master record and includes these working modules:
- EMD
- PBG

Later modules such as Indent, Technical Committee, Pre-Bid, Bid Evaluation, Negotiation, Approvals, PO Release, Inspection, Delivery, and Invoice flows will be linked to the same central procurement lifecycle.

## Project Structure

- `backend/`
  - `AuthService/`
  - `ProcurementManagementService/`
- `frontend/`
  - React UI for procurement workflows and dashboards
- `docs/`
  - architecture notes
  - process flow
  - future schema and release notes

## Immediate Build Strategy

1. Establish secure authentication and protected application shell.
2. Build a dedicated procurement service for procurement workflows and master data.
3. Start with central tender master plus EMD and PBG modules.
4. Expand step by step into indent, evaluation, negotiation, PO, and downstream execution workflows.
5. Keep all core records location-aware and audit-friendly from day one.

## Branch and Release Workflow

Recommended workflow:
- `main`: production-ready
- `develop`: integration/staging
- `feature/<module>-<name>`: new work
- `fix/<module>-<bug>`: bug fixes
- `hotfix/<issue>`: urgent production fixes from `main`

Merge strategy:
1. Push branch
2. Open PR to `develop`
3. Pass CI + review
4. Squash merge
5. Periodically PR `develop -> main`
6. Tag release (example: `v1.0.0`)

## GitHub Repository Setup

This PMS project follows an industry-style repository structure with:
- CI workflow under `.github/workflows/ci.yml`
- PR template under `.github/pull_request_template.md`
- protected `main` and `develop` branches
- work through feature/fix/hotfix branches instead of direct pushes

## Documentation

- Backend guide: `backend/README.md`
- Frontend guide: `frontend/README.md`
- Shared architecture note: `docs/ARCHITECTURE.md`
