# OPCAT Transfer Tool Frontend

This is a React frontend application for transferring SATS and CAT20 tokens.

## Features

- **Transfer SATS**: Transfer Bitcoin satoshis (SATS) to multiple addresses
- **Transfer CAT20**: Transfer CAT20 tokens to multiple addresses
- Modern user interface
- Responsive design

## Development

### Install Dependencies

```bash
yarn install
```

### Start Development Server

```bash
yarn dev
```

The application will run at http://localhost:5173.

### Build for Production

```bash
yarn build
```

### Preview Production Build

```bash
yarn preview
```

## Project Structure

```
src/
├── components/
│   ├── TransferBTC.tsx       # BTC transfer component
│   └── TransferCat20.tsx     # CAT20 token transfer component
├── App.tsx                   # Main application component
├── App.css                   # Application styles
└── main.tsx                  # Application entry point
```

## Routes

- `/` - Home page, displays feature overview
- `/transfer-btc` - BTC transfer page
- `/transfer-cat20` - CAT20 token transfer page

## Tech Stack

- React 19
- TypeScript
- React Router DOM
- Vite
- CSS3

## Notes

Currently, the transfer features are mock implementations. The actual transfer logic needs to be integrated with smart contracts.
