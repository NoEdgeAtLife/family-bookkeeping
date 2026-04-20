// Script to clean up migrated data (for testing purposes)
// Usage: node scripts/cleanup-migration.js <userId>

import "dotenv/config"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs, deleteDoc } from "firebase/firestore"

const firebaseConfig = {
    apiKey: process.env.VITE_APIKEY,
    authDomain: process.env.VITE_AUTH_DOMAIN,
    projectId: process.env.VITE_PROJECT_ID,
    storageBucket: process.env.VITE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_APP_ID
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function cleanupUser(userId) {
    console.log(`Cleaning up migrated data for user: ${userId}`)
    
    try {
        // Delete accounts subcollection
        const accountsRef = collection(db, "users", userId, "accounts")
        const accountsSnapshot = await getDocs(accountsRef)
        console.log(`  Deleting ${accountsSnapshot.size} accounts...`)
        for (const doc of accountsSnapshot.docs) {
            await deleteDoc(doc.ref)
        }
        
        // Delete transactions subcollection
        const txRef = collection(db, "users", userId, "transactions")
        const txSnapshot = await getDocs(txRef)
        console.log(`  Deleting ${txSnapshot.size} transactions...`)
        for (const doc of txSnapshot.docs) {
            await deleteDoc(doc.ref)
        }
        
        // Delete backups subcollection
        const backupsRef = collection(db, "users", userId, "backups")
        const backupsSnapshot = await getDocs(backupsRef)
        console.log(`  Deleting ${backupsSnapshot.size} backups...`)
        for (const doc of backupsSnapshot.docs) {
            await deleteDoc(doc.ref)
        }
        
        console.log(`✓ Cleanup complete for ${userId}`)
        
    } catch (error) {
        console.error(`❌ Cleanup failed:`, error)
        process.exit(1)
    }
}

const userId = process.argv[2]

if (!userId) {
    console.log("Usage: node scripts/cleanup-migration.js <userId>")
    process.exit(1)
}

cleanupUser(userId).then(() => process.exit(0))
