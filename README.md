# Family Bookkeeping

This is a family bookkeeping application built with Svelte and Firebase.

## Installation 

This project requires Node.js version 22 or later.

Clone the repository and install dependencies with npm:

```bash 
  git clone https://github.com/NoEdgeAtLife/family-bookkeeping.git
  cd family-bookkeeping
  npm install
```

## Developing

Start a development server:

```bash
npm run dev
# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building
To create a production version of your app:
```bash
npm run build
```

You can preview the production build with npm run preview.

## Firebase Configuration
This project uses Firebase for authentication and data storage. You need to set up your Firebase project and add the configuration to a .env file in the project root:

```
VITE_APIKEY=yourapikey
VITE_AUTH_DOMAIN=yourauthdomain
VITE_PROJECT_ID=yourprojectid
VITE_STORAGE_BUCKET=yourstoragebucket
VITE_MESSAGING_SENDER_ID=yourmessagingsenderid
VITE_APP_ID=yourappid
```
Replace yourapikey, yourauthdomain, etc. with your actual Firebase configuration values.

## License
MIT