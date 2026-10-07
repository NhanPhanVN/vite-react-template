# React + Vite + Hono + Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/vite-react-template)

This template provides a minimal setup for building a React application with TypeScript and Vite, designed to run on Cloudflare Workers. It features hot module replacement, ESLint integration, and the flexibility of Workers deployments.

![React + TypeScript + Vite + Cloudflare Workers](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fc7b4b62-442b-4769-641b-ad4422d74300/public)

<!-- dash-content-start -->

🚀 Supercharge your web development with this powerful stack:

- [**React**](https://react.dev/) - A modern UI library for building interactive interfaces
- [**Vite**](https://vite.dev/) - Lightning-fast build tooling and development server
- [**Hono**](https://hono.dev/) - Ultralight, modern backend framework
- [**Cloudflare Workers**](https://developers.cloudflare.com/workers/) - Edge computing platform for global deployment

### ✨ Key Features

- 🔥 Hot Module Replacement (HMR) for rapid development
- 📦 TypeScript support out of the box
- 🛠️ ESLint configuration included
- ⚡ Zero-config deployment to Cloudflare's global network
- 🎯 API routes with Hono's elegant routing
- 🔄 Full-stack development setup
- 🔎 Built-in Observability to monitor your Worker

Get started in minutes with local development or deploy directly via the Cloudflare dashboard. Perfect for building modern, performant web applications at the edge.

<!-- dash-content-end -->

## Getting Started

To start a new project with this template, run:

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/vite-react-template
```

A live deployment of this template is available at:
[https://react-vite-template.templates.workers.dev](https://react-vite-template.templates.workers.dev)

## Development

Install dependencies:

```bash
npm install
```

Start the development server with:

```bash
npm run dev
```

Your application will be available at [http://localhost:5173](http://localhost:5173).

## Shipping records

Shipping records and Picrd image URLs are stored in the D1 database configured
in `wrangler.jsonc`. Apply the migrations to the remote database before deploying:

```bash
npx wrangler d1 migrations apply d1 --remote --config wrangler.jsonc
```

The shipping migration replaces the old chat table and **drops its messages**.
This is irreversible for databases where that migration is applied.

The browser sends image uploads to the Worker, which forwards them to Picrd and
returns Picrd's image, page, and delete URLs. Image bytes are not stored in D1.
Uploads must be PNG, JPEG, WebP, or GIF and no larger than 10 MB. Picrd applies
a limit of 60 uploads per hour per IP; proxied uploads may share the Worker's
outbound IP limit.

Each shipment has one share link. Anyone with it can view the record, upload
photos into the sender/receiver front/back slots, or remove photos. Photo
deletion opens Picrd's confirmation page; after confirming there, remove the
photo from the shipment record.

The home page lists all shipments, including the receiver, shipped date, and a
red days-waiting badge until receipt is confirmed. Each record's status can be
changed from the list or shipment page: Shipped, On the way, or Return. The
receiver can confirm delivery on the shipment page. Shipment lists and detail
pages refresh once per second. Share dialogs show the current site's full URL,
a copy button, and a QR code.

To use the local development database instead, run:

```bash
npx wrangler d1 migrations apply d1 --local --config wrangler.jsonc
```

## Production

Build your project for production:

```bash
npm run build
```

Preview your build locally:

```bash
npm run preview
```

Deploy your project to Cloudflare Workers:

```bash
npm run build && npm run deploy
```

Monitor your workers:

```bash
npx wrangler tail
```

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://reactjs.org/)
- [Hono Documentation](https://hono.dev/)
