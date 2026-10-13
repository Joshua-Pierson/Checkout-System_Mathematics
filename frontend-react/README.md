# Checkout System — Original Frontend in React

Converted from your frontend.zip, preserving the original page structure and text instead of redesigning it.

## Install

Stop Vite with Ctrl+C. Back up your current frontend-react folder, then put this archive's frontend-react folder beside backend and frontend in your project. Do not nest it inside another frontend-react folder.

From the project root:

```bash
cd frontend-react
npm install
npm run dev
```

Open the Local URL. Keep your Python backend running separately. Node 20.19+ or 22.12+ is required.

## Appearance

- Student screen uses browser default styling, like your original index.html. Your original css/style.css was empty.
- The original student table, category dropdown, search, code form, cart rows, totals, checkout buttons, receipt placeholder, and Cancel Transaction are retained.
- Manager View links to the original Manager Menu and Add/Edit/Remove forms, now rendered in React.
- src/manager.css contains only the original manager stylesheet rules, scoped to manager pages: darkslategray background, centered content, button padding/margins, and aliceblue links. Original white headings are retained.
- No cards, custom fonts, extra checkout forms, JSON previews, or other new styling is included.
- Merge-conflict markers in the supplied index.html are removed. Both checkout controls and Cancel Transaction are retained.

## Behavior

React state replaces the old DOM manipulation. Student cart search, categories, stock limits, quantity controls, remove, cent totals, and cancellation remain functional. The cart stays intact when changing views.

The app uses your original GET http://127.0.0.1:5000/api/items endpoint. The response must be an array with item_id, name, unit_price, category, and stock_quantity. Backend CORS must allow the frontend origin. To change the URL, copy .env.example to .env.local, update VITE_API_BASE_URL, and restart Vite.

The original manager form submissions only logged JSON; this version also only logs JSON to the browser console, with preventDefault to avoid an unwanted page reload. No backend writes are invented. Show Payment Options and Cancel Checkout preserve the original console-only helper behavior. Receipt remains the original placeholder. No payment processing, sales submission, inventory changes, tax calculations, or manager authentication is implemented.

## Files

- src/App.jsx: navigation, inventory load, shared cart state.
- src/components/StudentCart.jsx: original student layout in JSX.
- src/components/CheckoutReceipt.jsx: original checkout controls.
- src/components/ManagerCatalog.jsx: manager view/menu navigation.
- src/components/manager/CatalogForm.jsx: original Add/Edit/Remove forms.
- src/api.js: inventory request.
- src/utils/cart.js: original validation and cent arithmetic.
- src/App.css: empty stylesheet, matching the original student CSS.
- src/manager.css: original manager CSS scoped to manager pages.

## Validation

Production build passes. Rendered React checks with a simulated DOM and sample API responses cover cart stock limits, search, manager navigation and forms, original manager CSS activation, cart persistence, and cancellation. No live Python backend or real-browser visual check was available.

```bash
npm test
npm run build
```
