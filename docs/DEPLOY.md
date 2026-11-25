# Deploying Lilavati

For maintainers and agents. The site is the Cloudflare Pages project `lilavati`, uploaded directly (no Git integration).

Get the project's upload token (`GET /accounts/{id}/pages/projects/lilavati/upload-token`, `result.jwt`)
into a private file, then:

```sh
(cd tools && npm i)
./build.sh
CF_PAGES_JWT_FILE=/path/to/jwt node tools/pages_upload.mjs   # uploads dist/site, writes /tmp/lilavati-manifest.json
```

and create the deployment: `POST /accounts/{id}/pages/projects/lilavati/deployments` with form fields
`manifest` (that JSON), `branch=main` and `_redirects` (the contents of `web/_redirects`, which sends the old
`/fourier/` and `/motion/` addresses to the new ones).
