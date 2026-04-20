// Migration utilities for converting from old structure to new structure
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    addDoc,
    getDocs,
    Timestamp 
} from "firebase/firestore"

// Default db will be undefined, must be passed in or set via setDb
let db = null

export function setDb(firestoreInstance) {
    db = firestoreInstance
}

// Try to import db from firebase.js if running in browser context
try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        const { db: browserDb } = await import("./firebase.js")
        db = browserDb
    }
} catch (e) {
    // Running in Node.js, db will be set by migration scripts
}

// ==================== BACKUP ====================

/**
 * Backup user data before migration
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Backed up data
 */
export async function backupUserData(userId) {
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
        throw new Error(`User ${userId} does not exist`)
    }
    
    const data = userDoc.data()
    const timestamp = new Date().toISOString()
    
    // Store backup in a separate collection
    const backupRef = collection(db, "users", userId, "backups")
    await addDoc(backupRef, {
        ...data,
        backupDate: timestamp,
        backupTimestamp: Timestamp.now()
    })
    
    return {
        userId,
        data,
        timestamp
    }
}

/**
 * Download backup data as JSON (for local storage)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Backup data
 */
export async function downloadBackup(userId) {
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
        throw new Error(`User ${userId} does not exist`)
    }
    
    const data = userDoc.data()
    
    return {
        userId,
        email: data.email,
        accounts: data.accounts || {},
        transactions: data.txs || [],
        backupDate: new Date().toISOString(),
        version: "1.0"
    }
}

// ==================== VALIDATION ====================

/**
 * Validate old data structure
 * @param {Object} data - User data
 * @returns {Object} Validation result
 */
export function validateOldStructure(data) {
    const errors = []
    const warnings = []
    
    if (!data) {
        errors.push("Data is null or undefined")
        return { valid: false, errors, warnings }
    }
    
    // Check accounts
    if (!data.accounts || typeof data.accounts !== "object") {
        errors.push("Accounts missing or invalid")
    } else {
        const accountEntries = Object.entries(data.accounts)
        if (accountEntries.length === 0) {
            warnings.push("No accounts found")
        }
        
        accountEntries.forEach(([name, balance]) => {
            if (!name || typeof name !== "string") {
                errors.push(`Invalid account name: ${name}`)
            }
            if (typeof balance !== "number") {
                errors.push(`Invalid balance for account ${name}: ${balance}`)
            }
        })
    }
    
    // Check transactions
    if (!data.txs) {
        warnings.push("No transactions field")
    } else if (!Array.isArray(data.txs)) {
        errors.push("Transactions is not an array")
    } else {
        data.txs.forEach((tx, index) => {
            if (!tx.from || typeof tx.from !== "string") {
                errors.push(`Transaction ${index}: Invalid 'from' field`)
            }
            if (!tx.to || typeof tx.to !== "string") {
                errors.push(`Transaction ${index}: Invalid 'to' field`)
            }
            if (typeof tx.amount !== "number") {
                errors.push(`Transaction ${index}: Invalid amount`)
            }
            if (!tx.date) {
                warnings.push(`Transaction ${index}: Missing date`)
            }
        })
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        accountCount: data.accounts ? Object.keys(data.accounts).length : 0,
        transactionCount: Array.isArray(data.txs) ? data.txs.length : 0
    }
}

/**
 * Validate new data structure
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Validation result
 */
export async function validateNewStructure(userId) {
    const errors = []
    const warnings = []
    
    try {
        // Check accounts subcollection
        const accountsRef = collection(db, "users", userId, "accounts")
        const accountsSnapshot = await getDocs(accountsRef)
        const accountCount = accountsSnapshot.size
        
        if (accountCount === 0) {
            warnings.push("No accounts in new structure")
        }
        
        const accountIds = new Set()
        accountsSnapshot.docs.forEach(doc => {
            const data = doc.data()
            accountIds.add(doc.id)
            
            if (!data.name) {
                errors.push(`Account ${doc.id}: Missing name`)
            }
            if (typeof data.balance !== "number") {
                errors.push(`Account ${doc.id}: Invalid balance`)
            }
            if (!data.createdAt) {
                warnings.push(`Account ${doc.id}: Missing createdAt`)
            }
        })
        
        // Check transactions subcollection
        const txRef = collection(db, "users", userId, "transactions")
        const txSnapshot = await getDocs(txRef)
        const transactionCount = txSnapshot.size
        
        if (transactionCount === 0) {
            warnings.push("No transactions in new structure")
        }
        
        txSnapshot.docs.forEach(doc => {
            const data = doc.data()
            
            if (!data.fromAccountId) {
                errors.push(`Transaction ${doc.id}: Missing fromAccountId`)
            } else if (!accountIds.has(data.fromAccountId)) {
                errors.push(`Transaction ${doc.id}: fromAccountId references non-existent account`)
            }
            
            if (!data.toAccountId) {
                errors.push(`Transaction ${doc.id}: Missing toAccountId`)
            } else if (!accountIds.has(data.toAccountId)) {
                errors.push(`Transaction ${doc.id}: toAccountId references non-existent account`)
            }
            
            if (typeof data.amount !== "number") {
                errors.push(`Transaction ${doc.id}: Invalid amount`)
            }
            
            if (!data.date) {
                errors.push(`Transaction ${doc.id}: Missing date`)
            }
        })
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            accountCount,
            transactionCount
        }
    } catch (error) {
        return {
            valid: false,
            errors: [error.message],
            warnings: [],
            accountCount: 0,
            transactionCount: 0
        }
    }
}

// ==================== MIGRATION ====================

/**
 * Migrate user data from old structure to new structure
 * @param {string} userId - User ID
 * @param {boolean} dryRun - If true, only validate without writing
 * @returns {Promise<Object>} Migration result
 */
export async function migrateUserData(userId, dryRun = false) {
    const result = {
        userId,
        success: false,
        dryRun,
        accountsCreated: 0,
        transactionsCreated: 0,
        errors: [],
        warnings: []
    }
    
    try {
        // Step 1: Get old data
        const userRef = doc(db, "users", userId)
        const userDoc = await getDoc(userRef)
        
        if (!userDoc.exists()) {
            result.errors.push("User document does not exist")
            return result
        }
        
        const oldData = userDoc.data()
        
        // Step 2: Validate old data
        const validation = validateOldStructure(oldData)
        result.warnings.push(...validation.warnings)
        
        if (!validation.valid) {
            result.errors.push(...validation.errors)
            return result
        }
        
        // Step 3: Create backup
        if (!dryRun) {
            await backupUserData(userId)
            result.backupCreated = true
        }
        
        // Step 4: Discover all accounts (from both accounts object and transactions)
        const accountBalances = {} // account name -> calculated balance
        const accountsFromAccounts = oldData.accounts || {}
        const transactions = oldData.txs || []
        
        // Start with accounts from the accounts object
        for (const [accountName, balance] of Object.entries(accountsFromAccounts)) {
            accountBalances[accountName] = parseFloat(balance) || 0
        }
        
        // Discover accounts from transactions and calculate balances
        for (const tx of transactions) {
            if (!tx.from || !tx.to) continue
            
            // Initialize accounts if they don't exist
            if (!(tx.from in accountBalances)) {
                accountBalances[tx.from] = 0
                result.warnings.push(`Auto-discovered account from transactions: ${tx.from}`)
            }
            if (!(tx.to in accountBalances)) {
                accountBalances[tx.to] = 0
                result.warnings.push(`Auto-discovered account from transactions: ${tx.to}`)
            }
            
            // Calculate balance (this is a simplified calculation)
            // Note: This may not be accurate if accounts object had the correct balances
            // but we're doing this for accounts that were missing from the accounts object
            const amount = parseFloat(tx.amount) || 0
            if (!(tx.from in accountsFromAccounts)) {
                accountBalances[tx.from] -= amount
            }
            if (!(tx.to in accountsFromAccounts)) {
                accountBalances[tx.to] += amount
            }
        }
        
        // Step 5: Create accounts in new structure
        const accountMapping = {} // old name -> new ID
        
        for (const [accountName, balance] of Object.entries(accountBalances)) {
            if (dryRun) {
                // Create mock ID for dry run
                accountMapping[accountName] = `mock_${accountName.replace(/\s+/g, '_')}`
                result.accountsCreated++
            } else {
                const accountRef = collection(db, "users", userId, "accounts")
                const newAccountDoc = await addDoc(accountRef, {
                    name: accountName,
                    balance: balance,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                })
                accountMapping[accountName] = newAccountDoc.id
                result.accountsCreated++
            }
        }
        
        // Step 6: Migrate transactions
        for (const tx of transactions) {
            if (!tx.from || !tx.to) {
                result.warnings.push(`Skipping transaction: Missing from or to field`)
                continue
            }
            
            const fromAccountId = accountMapping[tx.from]
            const toAccountId = accountMapping[tx.to]
            
            if (!fromAccountId || !toAccountId) {
                result.warnings.push(`Skipping transaction: Failed to map accounts ${tx.from} or ${tx.to}`)
                continue
            }
            
            if (dryRun) {
                result.transactionsCreated++
            } else {
                const txRef = collection(db, "users", userId, "transactions")
                
                // Parse date
                let dateTimestamp
                try {
                    dateTimestamp = tx.date ? Timestamp.fromDate(new Date(tx.date)) : Timestamp.now()
                } catch (e) {
                    dateTimestamp = Timestamp.now()
                    result.warnings.push(`Invalid date for transaction, using current time: ${tx.date}`)
                }
                
                // Parse createdAt
                let createdAtTimestamp
                try {
                    createdAtTimestamp = tx.createdAt ? Timestamp.fromDate(new Date(tx.createdAt)) : dateTimestamp
                } catch (e) {
                    createdAtTimestamp = dateTimestamp
                }
                
                await addDoc(txRef, {
                    fromAccountId,
                    toAccountId,
                    fromAccountName: tx.from,
                    toAccountName: tx.to,
                    amount: parseFloat(tx.amount) || 0,
                    date: dateTimestamp,
                    description: tx.description || "",
                    createdAt: createdAtTimestamp
                })
                
                result.transactionsCreated++
            }
        }
        
        // Step 7: Validate new structure (if not dry run)
        if (!dryRun) {
            const newValidation = await validateNewStructure(userId)
            result.warnings.push(...newValidation.warnings)
            
            if (!newValidation.valid) {
                result.errors.push("New structure validation failed:")
                result.errors.push(...newValidation.errors)
                return result
            }
        }
        
        result.success = true
        return result
        
    } catch (error) {
        result.errors.push(`Migration error: ${error.message}`)
        return result
    }
}

/**
 * Compare old and new structures to verify migration
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Comparison result
 */
export async function compareStructures(userId) {
    const result = {
        userId,
        matches: true,
        differences: [],
        oldAccountCount: 0,
        newAccountCount: 0,
        oldTransactionCount: 0,
        newTransactionCount: 0
    }
    
    try {
        // Get old data
        const userRef = doc(db, "users", userId)
        const userDoc = await getDoc(userRef)
        
        if (!userDoc.exists()) {
            result.differences.push("Old structure does not exist")
            result.matches = false
            return result
        }
        
        const oldData = userDoc.data()
        result.oldAccountCount = oldData.accounts ? Object.keys(oldData.accounts).length : 0
        result.oldTransactionCount = Array.isArray(oldData.txs) ? oldData.txs.length : 0
        
        // Get new data
        const accountsRef = collection(db, "users", userId, "accounts")
        const accountsSnapshot = await getDocs(accountsRef)
        result.newAccountCount = accountsSnapshot.size
        
        const txRef = collection(db, "users", userId, "transactions")
        const txSnapshot = await getDocs(txRef)
        result.newTransactionCount = txSnapshot.size
        
        // Compare counts
        if (result.oldAccountCount !== result.newAccountCount) {
            result.differences.push(`Account count mismatch: ${result.oldAccountCount} old vs ${result.newAccountCount} new`)
            result.matches = false
        }
        
        if (result.oldTransactionCount !== result.newTransactionCount) {
            result.differences.push(`Transaction count mismatch: ${result.oldTransactionCount} old vs ${result.newTransactionCount} new`)
            result.matches = false
        }
        
        // Compare account names
        const oldAccountNames = new Set(Object.keys(oldData.accounts || {}))
        const newAccountNames = new Set()
        
        accountsSnapshot.docs.forEach(doc => {
            newAccountNames.add(doc.data().name)
        })
        
        for (const name of oldAccountNames) {
            if (!newAccountNames.has(name)) {
                result.differences.push(`Account missing in new structure: ${name}`)
                result.matches = false
            }
        }
        
        for (const name of newAccountNames) {
            if (!oldAccountNames.has(name)) {
                result.differences.push(`Extra account in new structure: ${name}`)
                result.matches = false
            }
        }
        
        return result
        
    } catch (error) {
        result.differences.push(`Comparison error: ${error.message}`)
        result.matches = false
        return result
    }
}

/**
 * Rollback migration - restore from backup
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Rollback result
 */
export async function rollbackMigration(userId) {
    try {
        // Get most recent backup
        const backupsRef = collection(db, "users", userId, "backups")
        const backupsSnapshot = await getDocs(backupsRef)
        
        if (backupsSnapshot.empty) {
            throw new Error("No backups found")
        }
        
        // Get most recent backup
        const backups = backupsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
        
        backups.sort((a, b) => {
            const aTime = a.backupTimestamp?.toMillis() || 0
            const bTime = b.backupTimestamp?.toMillis() || 0
            return bTime - aTime
        })
        
        const latestBackup = backups[0]
        
        // Restore to main document
        const userRef = doc(db, "users", userId)
        const { id, backupDate, backupTimestamp, ...dataToRestore } = latestBackup
        
        await setDoc(userRef, dataToRestore)
        
        return {
            success: true,
            restoredFrom: backupDate || "unknown",
            message: "Data restored from backup successfully"
        }
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}
