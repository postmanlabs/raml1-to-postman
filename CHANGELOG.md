# RAML 1.0 to Postman Changelog

## [Unreleased]

## [v1.0.0] - 2025-03-10

### Breaking Changes

- Drop support for node < v18.

## [v0.4.0] - 2024-07-10

### Chore

-   Updated postman-collection to v4.4.0.

## [v0.3.0] - 2024-06-07

### Fixed

-   Removed usage of archived webapi-parser for error reporting causing issues with app bundling.

## [v0.2.0] - 2024-02-15

### Added

-   Added support for reporting UserErrors when provided definition is invalid.

## [v0.1.8] - 2023-04-17

### Added

-   GitHub Actions for Release management.

### Changed

-   Bumped up minimum Node version to 12.
-   Unit tests now run on Node versions 12, 16 and 18.

### Fixed

-   Fixed an issue where conversion failed if securitySchemes are not resolved.

## [0.1.7] - 2023-03-21

### Added

-   Added support for resource types.

## Previous Releases

Newer releases follow the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

#### v0.1.6 (Oct 15, 2020)

-   Fixed type error "path must be string" when nonresolved includes are present.

#### v0.1.5 (Jul 14, 2020)

-   Update folder import flow to work in web.

#### v0.1.4 (April 28, 2020)

-   Add a function to return meta data of a spec.

#### v0.1.3 (April 21, 2020)

-   Fixed multiple responses with same code returning example with 500 code.

#### v0.1.2 (March 31, 2020)

-   Fixed default response body from object to null.

#### v0.1.1 (December 20, 2019)

-   Updated flow for conversion of multiple root of document files for folder import.

#### v0.1.0 (November 29, 2019)

-   npm module published

#### v0.0.1 (November 28, 2019)

-   Base release

[Unreleased]: https://github.com/postmanlabs/raml1-to-postman/compare/v1.0.0...HEAD

[v1.0.0]: https://github.com/postmanlabs/raml1-to-postman/compare/v0.4.0...v1.0.0

[v0.4.0]: https://github.com/postmanlabs/raml1-to-postman/compare/v0.3.0...v0.4.0

[v0.3.0]: https://github.com/postmanlabs/raml1-to-postman/compare/v0.2.0...v0.3.0

[v0.2.0]: https://github.com/postmanlabs/raml1-to-postman/compare/v0.1.8...v0.2.0

[v0.1.8]: https://github.com/postmanlabs/raml1-to-postman/compare/0.1.7...v0.1.8

[0.1.7]: https://github.com/postmanlabs/raml1-to-postman/compare/0.1.6...0.1.7
