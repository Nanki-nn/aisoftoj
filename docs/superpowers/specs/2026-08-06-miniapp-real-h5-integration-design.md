# Miniapp Real H5 Integration Design

## Goal

Run the Taro student client as an H5 preview against the real Spring Boot API and MySQL data, while preserving WeChat authorization in the production mini-program build.

## Scope

- Add an H5-only email and password login path to the existing miniapp login page.
- Reuse the backend's existing `POST /auth/login` contract and the miniapp's existing JWT session storage.
- Keep `Taro.login()` plus `POST /auth/wechat/login` unchanged for WeChat builds.
- Add the Taro H5 platform plugin and project scripts required to build and serve the preview.
- Start disposable local MySQL and backend containers for the preview.
- Build and serve the H5 client at `http://127.0.0.1:4173` with API base URL `http://127.0.0.1:8080`.
- Create a local demo user through the existing registration API or an equivalent one-time local setup call. Demo credentials must not be committed.

Out of scope:

- A production web login product surface.
- A backend impersonation, bypass, or fixed-token endpoint.
- Changes to WeChat login behavior.
- Committing container data, local credentials, or H5 build output.

## Architecture

The login page selects its authentication UI with the compile-time `process.env.TARO_ENV === 'h5'` branch. In the web build it renders controlled email and password fields and submits them through a new miniapp API helper. In the WeChat build the H5 branch is removed by the build and the page renders the existing one-click WeChat button and calls the existing WeChat helper.

Both helpers return `AuthResponse`, require the user role to be `USER`, and persist the same token and user payload through `saveAuthSession`. Downstream pages therefore remain unaware of the login mechanism.

The local runtime consists of:

1. MySQL initialized from the repository `db_schema.sql` snapshot.
2. Spring Boot connected to that database over a private Docker bridge network and configured to allow the H5 preview origin.
3. The Taro H5 build configured with the local backend base URL.
4. A static server exposing the H5 build on port 4173.

The miniapp adds `@tarojs/plugin-platform-h5` at the same pinned version as the other Taro packages and adds any peer package required by the pinned plugin. The plugin is registered alongside the existing React and WeChat plugins. `package.json` gains `build:h5` and `dev:h5` scripts that invoke `taro build --type h5` with and without watch mode. The H5 plugin is responsible for producing the HTML entry; no hand-written file is kept in `dist`.

## UI Behavior

For H5 only, the login action area contains:

- An email input.
- A password input.
- A primary `登录并进入` button.
- Inline validation for empty fields.
- The existing server error area for API failures.

The masthead, product copy, trust row, and legal copy remain unchanged. The WeChat build continues to show only the existing WeChat login button.

On successful authentication, the page enters `/pages/home/index`. The existing `Taro.switchTab` is retained only if the H5 build verifies that tab routing works; otherwise a small platform-aware navigation helper uses `Taro.reLaunch` for H5 and `Taro.switchTab` for WeChat. On failure it remains on the login page, re-enables submission, and shows the backend error message. Repeated clicks are prevented while a request is in flight.

## API And Security

Add a miniapp service function that sends:

```json
{
  "email": "student@example.com",
  "password": "local-password"
}
```

to `POST /auth/login`. It must apply the same role check and session persistence as WeChat login. No password is logged or stored after the request. No development authentication shortcut is added to the backend.

The local backend process receives `CORS_ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173`. This is runtime configuration, not a relaxation of production defaults.

## Local Data And Runtime

Use a dedicated Docker bridge network named `aisoftoj-preview` with disposable containers `aisoftoj-preview-mysql` and `aisoftoj-preview-backend`. Container names and host ports 3306 and 8080 must be checked before startup. If a required port or name is occupied, use a distinct preview port/name and propagate that port to the dependent runtime configuration instead of deleting existing resources.

The MySQL container uses a pinned MySQL 8 image, creates the `aisoftoj` database, and mounts the repository `db_schema.sql` read-only into `/docker-entrypoint-initdb.d/`. Because this schema is the complete local snapshot, the backend preview sets `FLYWAY_ENABLED=false`; migrations are not applied a second time.

The backend JAR is produced with the repository Maven build. If host Maven is unavailable, run the build in a pinned Maven JDK 8 container with the repository mounted and the local Maven cache stored in a disposable or user cache volume. The backend runs in a pinned JRE 8 container on the preview network with these overrides:

- `SPRING_DATASOURCE_URL=jdbc:mysql://aisoftoj-preview-mysql:3306/aisoftoj?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai`
- `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD` matching the disposable MySQL container.
- `CORS_ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173`.
- A non-production local JWT secret supplied at runtime.

The H5 client is built with `TARO_APP_API_BASE_URL=http://127.0.0.1:8080 pnpm run build:h5` and served with `python3 -m http.server 4173 --directory dist` from the miniapp directory.

Registration requires email verification, so the disposable preview database receives one local-only `USER` row through a one-time SQL command after startup. The password is generated for this run and converted to a BCrypt hash before insertion. The email, plaintext password, and hash are not written to tracked files. Login still uses the normal `POST /auth/login` endpoint and the backend-issued JWT.

## Tests

- Unit test the password-login API helper: request path, payload, role rejection, and session persistence.
- Component or extracted-logic test the environment branch where practical: H5 selects password login and WeChat selects the existing login behavior.
- Run the miniapp test suite and H5 build.
- Verify in a mobile viewport that a real login reaches the home page.
- Verify the authenticated paper list request reaches the backend and that navigation among the tab pages works.
- Confirm a WeChat production build still compiles with the existing WeChat login path.

## Acceptance Criteria

- The H5 preview can log in with a real database-backed user and receives a backend-issued JWT.
- After login, the home and paper pages render data returned by the real API, or an explicit empty state when the database contains no papers.
- Refreshing the H5 page restores the saved session through `/auth/me`.
- The WeChat build does not expose the email/password form.
- No authentication bypass, demo password, database volume, or H5 artifact is committed.
