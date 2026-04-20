// Test script for single user migration
// Usage: node scripts/test-migration.js <userId>

import "dotenv/config"
import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { migrateUserData, validateNewStructure, compareStructures, setDb } from "../src/lib/firebase/migration.js"

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

// Set db instance for migration functions
setDb(db)

async function testSingleUser(userId) {
    console.log("=".repeat(60))
    console.log("SINGLE USER MIGRATION TEST")
    console.log("=".repeat(60))
    console.log(`User ID: ${userId}`)
    console.log("=".repeat(60))
    console.log("")
    
    try {
        // Step 1: Dry run migration
        console.log("Step 1: Dry run migration...")
        console.log("-".repeat(60))
        const dryRunResult = await migrateUserData(userId, true)
        console.log("Result:", JSON.stringify(dryRunResult, null, 2))
        console.log("")
        
        if (!dryRunResult.success) {
            console.log("❌ Dry run failed. Stopping test.")
            return
        }
        
        console.log(`✓ Dry run successful`)
        console.log(`  - Accounts to create: ${dryRunResult.accountsCreated}`)
        console.log(`  - Transactions to create: ${dryRunResult.transactionsCreated}`)
        console.log(`  - Warnings: ${dryRunResult.warnings.length}`)
        console.log("")
        
        // Step 2: Actual migration
        console.log("Step 2: Running actual migration...")
        console.log("-".repeat(60))
        const migrationResult = await migrateUserData(userId, false)
        console.log("Result:", JSON.stringify(migrationResult, null, 2))
        console.log("")
        
        if (!migrationResult.success) {
            console.log("❌ Migration failed")
            console.log("Errors:", migrationResult.errors)
            return
        }
        
        console.log(`✓ Migration successful`)
        console.log(`  - Accounts created: ${migrationResult.accountsCreated}`)
        console.log(`  - Transactions created: ${migrationResult.transactionsCreated}`)
        console.log(`  - Backup created: ${migrationResult.backupCreated}`)
        console.log("")
        
        // Step 3: Validate new structure
        console.log("Step 3: Validating new structure...")
        console.log("-".repeat(60))
        const validation = await validateNewStructure(userId)
        console.log("Result:", JSON.stringify(validation, null, 2))
        console.log("")
        
        if (!validation.valid) {
            console.log("❌ Validation failed")
            console.log("Errors:", validation.errors)
            return
        }
        
        console.log(`✓ Validation successful`)
        console.log(`  - Accounts: ${validation.accountCount}`)
        console.log(`  - Transactions: ${validation.transactionCount}`)
        console.log(`  - Warnings: ${validation.warnings.length}`)
        console.log("")
        
        // Step 4: Compare structures
        console.log("Step 4: Comparing old and new structures...")
        console.log("-".repeat(60))
        const comparison = await compareStructures(userId)
        console.log("Result:", JSON.stringify(comparison, null, 2))
        console.log("")
        
        if (!comparison.matches) {
            console.log("⚠️  Structures do not match")
            console.log("Differences:", comparison.differences)
        } else {
            console.log(`✓ Structures match perfectly`)
        }
        
        console.log("")
        console.log("=".repeat(60))
        console.log("TEST SUMMARY")
        console.log("=".repeat(60))
        console.log(`Old structure: ${comparison.oldAccountCount} accounts, ${comparison.oldTransactionCount} transactions`)
        console.log(`New structure: ${comparison.newAccountCount} accounts, ${comparison.newTransactionCount} transactions`)
        console.log(`Match: ${comparison.matches ? "YES" : "NO"}`)
        console.log("=".repeat(60))
        console.log("")
        console.log("✓ All tests completed successfully!")
        
    } catch (error) {
        console.error("\n❌ Test failed with error:")
        console.error(error)
        process.exit(1)
    }
}

// Main
const userId = process.argv[2]

if (!userId) {
    console.log("Usage: node scripts/test-migration.js <userId>")
    console.log("")
    console.log("This script will:")
    console.log("  1. Run a dry-run migration")
    console.log("  2. Run the actual migration")
    console.log("  3. Validate the new structure")
    console.log("  4. Compare old and new structures")
    process.exit(1)
}

testSingleUser(userId)
