# Tahin Spare Suppliers

## 🎯 Project Overview
**Tahin Spare Suppliers** is a business website for a marine machinery and spare parts supplier based in Bangladesh. 

**Core Technologies:**
- **Framework**: [Astro](https://astro.build/) (v6.x)
- **Styling**: Vanilla CSS (`src/styles/global.css`)
- **Fonts**: Inter, Playfair Display, and Dancing Script (managed via Astro's built-in font providers in `astro.config.mjs`).
- **Animations**: Custom vanilla JavaScript IntersectionObserver implemented in `MainLayout.astro` for scroll reveal animations.

## 📦 Architecture & Structure
The project follows a standard Astro directory structure:
- `src/pages/`: Contains the file-based routing for the application (`index.astro`, `about.astro`, `services.astro`, `products.astro`, `enquiry.astro`, `contact.astro`).
- `src/components/`: Reusable UI components (`Header.astro`, `Navbar.astro`, `Footer.astro`, `Icon.astro`).
- `src/layouts/`: Defines the base page structure, particularly `MainLayout.astro` which handles meta tags, font preloading, and global scripts.
- `public/images/`: Static image assets serving the website's visual content.

## 🚀 Building and Running

Use the following npm scripts to manage the application lifecycle:

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the site for production |
| `npm run preview` | Preview the production build locally |

## ✅ Development Conventions
- **Component-Driven:** Keep UI elements modular by creating new `.astro` components in `src/components/`.
- **Styling:** The project utilizes standard CSS. Inline stylesheets are enabled for production builds (`inlineStylesheets: "always"` in `astro.config.mjs`).
- **Animations:** Use the pre-existing scroll reveal classes (`.reveal`, `.reveal-left`, `.reveal-right`, `.reveal-scale`, `.reveal-stagger`) on HTML elements to animate them as they enter the viewport.
- **Assets:** Any new images should be placed in `public/images/` and referenced from the root `/images/...`.
- **SEO & Head Tags:** `MainLayout.astro` manages the `<head>`. Pass `title`, `activeNav`, and `preloadImage` as props to the layout component to update metadata per page.
