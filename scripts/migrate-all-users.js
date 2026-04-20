// Standalone migration script for migrating all users
// Run this with: node scripts/migrate-all-users.js

import "dotenv/config"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs } from "firebase/firestore"
import { migrateUserData, validateNewStructure, compareStructures, setDb } from "../src/lib/firebase/migration.js"

// Firebase config - load from environment
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

// Configuration
const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 10
const DELAY_BETWEEN_BATCHES = 2000 // ms

/**
 * Get all user IDs from Firestore
 */
async function getAllUserIds() {
    const usersRef = collection(db, "users")
    const snapshot = await getDocs(usersRef)
    return snapshot.docs.map(doc => doc.id)
}

/**
 * Migrate users in batches
 */
async function migrateAllUsers() {
    console.log("=".repeat(60))
    console.log("FIRESTORE MIGRATION SCRIPT")
    console.log("=".repeat(60))
    console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE MIGRATION"}`)
    console.log(`Batch size: ${BATCH_SIZE}`)
    console.log("=".repeat(60))
    console.log("")
    
    try {
        // Get all user IDs
        console.log("Fetching user IDs...")
        const userIds = await getAllUserIds()
        console.log(`Found ${userIds.length} users to migrate\n`)
        
        if (userIds.length === 0) {
            console.log("No users found. Exiting.")
            return
        }
        
        // Statistics
        const stats = {
            total: userIds.length,
            successful: 0,
            failed: 0,
            skipped: 0,
            totalAccounts: 0,
            totalTransactions: 0,
            errors: []
        }
        
        // Process in batches
        for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
            const batch = userIds.slice(i, i + BATCH_SIZE)
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1
            const totalBatches = Math.ceil(userIds.length / BATCH_SIZE)
            
            console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (users ${i + 1}-${Math.min(i + BATCH_SIZE, userIds.length)})`)
            console.log("-".repeat(60))
            
            // Process batch in parallel
            const results = await Promise.allSettled(
                batch.map(async (userId) => {
                    console.log(`  Migrating user: ${userId}...`)
                    const result = await migrateUserData(userId, DRY_RUN)
                    
                    if (result.success) {
                        console.log(`  ✓ ${userId}: ${result.accountsCreated} accounts, ${result.transactionsCreated} transactions`)
                        if (result.warnings.length > 0) {
                            console.log(`    Warnings: ${result.warnings.length}`)
                        }
                    } else {
                        console.log(`  ✗ ${userId}: Migration failed`)
                        console.log(`    Errors: ${result.errors.join(", ")}`)
                    }
                    
                    return result
                })
            )
            
            // Update statistics
            results.forEach((result, index) => {
                if (result.status === "fulfilled") {
                    const migrationResult = result.value
                    if (migrationResult.success) {
                        stats.successful++
                        stats.totalAccounts += migrationResult.accountsCreated
                        stats.totalTransactions += migrationResult.transactionsCreated
                    } else {
                        stats.failed++
                        stats.errors.push({
                            userId: batch[index],
                            errors: migrationResult.errors
                        })
                    }
                } else {
                    stats.failed++
                    stats.errors.push({
                        userId: batch[index],
                        errors: [result.reason?.message || "Unknown error"]
                    })
                }
            })
            
            // Delay between batches to avoid rate limits
            if (i + BATCH_SIZE < userIds.length) {
                console.log(`\nWaiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
            }
        }
        
        // Print final statistics
        console.log("\n" + "=".repeat(60))
        console.log("MIGRATION SUMMARY")
        console.log("=".repeat(60))
        console.log(`Total users:           ${stats.total}`)
        console.log(`Successful:            ${stats.successful}`)
        console.log(`Failed:                ${stats.failed}`)
        console.log(`Total accounts:        ${stats.totalAccounts}`)
        console.log(`Total transactions:    ${stats.totalTransactions}`)
        console.log("=".repeat(60))
        
        if (stats.errors.length > 0) {
            console.log("\nERRORS:")
            stats.errors.forEach(error => {
                console.log(`\n  User: ${error.userId}`)
                error.errors.forEach(err => {
                    console.log(`    - ${err}`)
                })
            })
        }
        
        if (DRY_RUN) {
            console.log("\n⚠️  This was a DRY RUN - no changes were made")
            console.log("Run without --dry-run to perform actual migration")
        } else {
            console.log("\n✓ Migration complete!")
        }
        
    } catch (error) {
        console.error("\n❌ Fatal error during migration:")
        console.error(error)
        process.exit(1)
    }
}

/**
 * Validate migration for all users
 */
async function validateAllUsers() {
    console.log("=".repeat(60))
    console.log("MIGRATION VALIDATION")
    console.log("=".repeat(60))
    console.log("")
    
    try {
        const userIds = await getAllUserIds()
        console.log(`Validating ${userIds.length} users...\n`)
        
        const stats = {
            total: userIds.length,
            valid: 0,
            invalid: 0,
            errors: []
        }
        
        for (const userId of userIds) {
            const validation = await validateNewStructure(userId)
            
            if (validation.valid) {
                console.log(`✓ ${userId}: ${validation.accountCount} accounts, ${validation.transactionCount} transactions`)
                stats.valid++
            } else {
                console.log(`✗ ${userId}: Validation failed`)
                console.log(`  Errors: ${validation.errors.join(", ")}`)
                stats.invalid++
                stats.errors.push({
                    userId,
                    errors: validation.errors
                })
            }
        }
        
        console.log("\n" + "=".repeat(60))
        console.log("VALIDATION SUMMARY")
        console.log("=".repeat(60))
        console.log(`Total users:    ${stats.total}`)
        console.log(`Valid:          ${stats.valid}`)
        console.log(`Invalid:        ${stats.invalid}`)
        console.log("=".repeat(60))
        
        if (stats.errors.length > 0) {
            console.log("\nVALIDATION ERRORS:")
            stats.errors.forEach(error => {
                console.log(`\n  User: ${error.userId}`)
                error.errors.forEach(err => {
                    console.log(`    - ${err}`)
                })
            })
        }
        
    } catch (error) {
        console.error("\n❌ Fatal error during validation:")
        console.error(error)
        process.exit(1)
    }
}

/**
 * Compare old and new structures for all users
 */
async function compareAllUsers() {
    console.log("=".repeat(60))
    console.log("STRUCTURE COMPARISON")
    console.log("=".repeat(60))
    console.log("")
    
    try {
        const userIds = await getAllUserIds()
        console.log(`Comparing structures for ${userIds.length} users...\n`)
        
        const stats = {
            total: userIds.length,
            matching: 0,
            different: 0,
            errors: []
        }
        
        for (const userId of userIds) {
            const comparison = await compareStructures(userId)
            
            if (comparison.matches) {
                console.log(`✓ ${userId}: Structures match (${comparison.oldAccountCount} accounts, ${comparison.oldTransactionCount} txs)`)
                stats.matching++
            } else {
                console.log(`✗ ${userId}: Structures differ`)
                comparison.differences.forEach(diff => {
                    console.log(`    - ${diff}`)
                })
                stats.different++
                stats.errors.push({
                    userId,
                    differences: comparison.differences
                })
            }
        }
        
        console.log("\n" + "=".repeat(60))
        console.log("COMPARISON SUMMARY")
        console.log("=".repeat(60))
        console.log(`Total users:    ${stats.total}`)
        console.log(`Matching:       ${stats.matching}`)
        console.log(`Different:      ${stats.different}`)
        console.log("=".repeat(60))
        
    } catch (error) {
        console.error("\n❌ Fatal error during comparison:")
        console.error(error)
        process.exit(1)
    }
}

// Main execution
const command = process.argv[2]

switch (command) {
    case "migrate":
        migrateAllUsers()
        break
    case "validate":
        validateAllUsers()
        break
    case "compare":
        compareAllUsers()
        break
    default:
        console.log("Usage:")
        console.log("  node scripts/migrate-all-users.js migrate [--dry-run]")
        console.log("  node scripts/migrate-all-users.js validate")
        console.log("  node scripts/migrate-all-users.js compare")
        console.log("")
        console.log("Commands:")
        console.log("  migrate  - Migrate all users from old to new structure")
        console.log("  validate - Validate new structure for all users")
        console.log("  compare  - Compare old and new structures")
        console.log("")
        console.log("Options:")
        console.log("  --dry-run  - Run migration without making changes")
        process.exit(1)
}
