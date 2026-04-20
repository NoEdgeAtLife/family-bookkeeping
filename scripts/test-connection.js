// Simple Firebase connection test
import "dotenv/config"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore"

const firebaseConfig = {
    apiKey: process.env.VITE_APIKEY,
    authDomain: process.env.VITE_AUTH_DOMAIN,
    projectId: process.env.VITE_PROJECT_ID,
    storageBucket: process.env.VITE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_APP_ID
}

console.log("Initializing Firebase...")
console.log("Project ID:", firebaseConfig.projectId)

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

console.log("Firebase initialized successfully")
console.log("Attempting to fetch users collection...")

try {
    const usersRef = collection(db, "users")
    const snapshot = await getDocs(usersRef)
    
    console.log(`Found ${snapshot.size} users`)
    
    snapshot.docs.forEach(doc => {
        console.log(`  - ${doc.id}`)
    })
    
    if (snapshot.size > 0) {
        console.log("\n✓ Firebase connection successful!")
    } else {
        console.log("\n⚠️  No users found in database")
    }
    
    process.exit(0)
} catch (error) {
    console.error("\n❌ Error connecting to Firebase:")
    console.error(error)
    process.exit(1)
}
