# Equinox V2 Full Production Release Candidate Specification

## Identity

- **Release Candidate Tag**: `v1.1.0-full-v2-production-rc.1`
- **Target Production Tag**: `v1.1.0-full-v2-production-ready`
- **GA Governance Tag**: `v1.1.0-full-v2-ga-stabilized`
- **Rollback Target Tag**: `v1.0.0-runtime-safety-ready` (`cfafc8c7a90c32da24d28f13bfb0ed4f28344fe7`)
- **Homologated Package**: `data/competitive/validated-packages/active-v2`
- **Package Digest**: `sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665`

---

## Allowed Claims

- Full competitive pipeline versioned and tracked by Git.
- Full competitive pipeline fully reproducible from committed sources.
- Runtime boundary verified and enforced.
- Active-v2 package homologated and preserved without rebuilds.
- Single candidate artifact sealed for staging, shadow, canary, and GA.

---

## Prohibited Claims

- Full V2 deployed (until Gate 4/5 rollout).
- Full V2 serving production traffic (until 100% GA).
- Full V2 stabilized (until Gate 5 post-GA stabilization).
