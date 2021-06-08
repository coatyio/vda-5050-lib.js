# Changelog

## [1.0.5](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.4...v1.0.5) (2021-06-08)

This patch release fixes an issue in the virtual AGV adapter.

### Bug Fixes

* **adapter:** fix issue in VirtualAgvAdapter concerning update of vehicle orientation while traversing an edge ([96a1475](https://github.com/coatyio/vda-5050-lib.js/commit/96a14752f8da78c182f08d866f64efc1cf947c2e))

## [1.0.4](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.3...v1.0.4) (2021-05-21)

This patch release fixes an issue concerning client restart.

### Bug Fixes

* **client:** reject consecutive invocations of method `start` as long as broker is not reachable ([b3400e3](https://github.com/coatyio/vda-5050-lib.js/commit/b3400e38611c8118190727e1c95d56e2dd70a428))

## [1.0.3](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.2...v1.0.3) (2021-04-01)

This patch release clarifies that the library is only compatible with Node.js v11 or newer.

### Bug Fixes

* library is only compatible with Node.js v11 or newer ([7562b26](https://github.com/coatyio/vda-5050-lib.js/commit/7562b2649ba3b1e0d91f6b441ea72dc0830be243))

## [1.0.2](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.1...v1.0.2) (2021-03-03)

This patch release fixes the test coverage badge in README.

## 1.0.1 (2021-03-03)

Initial release.