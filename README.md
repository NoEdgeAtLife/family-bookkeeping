# Family Bookkeeping

A small family bookkeeping Progressive Web App built with SvelteKit and Firebase.

## Stack

- SvelteKit 2 + Svelte 4
- Firebase Authentication + Firestore
- Vite 5
- Node.js 22+

## Data Model

The app now uses the Firestore subcollection structure as the only runtime model:

```
users/{userId}/accounts/{accountId}
users/{userId}/transactions/{transactionId}
```

Runtime store shape in the app:

- `data.accounts` -> `{ [accountName]: balance }`
- `data.accountIds` -> `{ [accountName]: accountId }`
- `data.transactions` -> `[{ id, from, to, amount, date, description, createdAt }]`

## Installation

```bash
git clone https://github.com/NoEdgeAtLife/family-bookkeeping.git
cd family-bookkeeping
npm install
```

## Development

```bash
npm run dev
npm run dev -- --open
```

## Build

```bash
npm run build
npm run preview
```

## Firebase Configuration

Create a `.env` file in the project root:

```bash
VITE_APIKEY=yourapikey
VITE_AUTH_DOMAIN=yourauthdomain
VITE_PROJECT_ID=yourprojectid
VITE_STORAGE_BUCKET=yourstoragebucket
VITE_MESSAGING_SENDER_ID=yourmessagingsenderid
VITE_APP_ID=yourappid
```

## License

MIT
