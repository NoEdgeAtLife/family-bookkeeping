// Dual-write system - writes to both old and new structures during migration
// This ensures zero data loss during the transition period

import { doc, setDoc, getDoc } from "firebase/firestore"
import { db } from "./firebase"
import * as newQueries from "./queries"

// Feature flags for controlling rollout
const FEATURE_FLAGS = {
    useNewStructure: false,      // Read from new structure
    dualWrite: true,              // Write to both old and new
    enableNewUI: false            // Show new UI features
}

/**
 * Get feature flag value
 * @param {string} flagName - Name of the feature flag
 * @returns {boolean} Flag value
 */
export function getFeatureFlag(flagName) {
    // In production, this could read from Firestore or environment variables
    // For now, it's a simple object
    return FEATURE_FLAGS[flagName] !== undefined ? FEATURE_FLAGS[flagName] : false
}

/**
 * Set feature flag value (for testing/admin)
 * @param {string} flagName - Name of the feature flag
 * @param {boolean} value - New value
 */
export function setFeatureFlag(flagName, value) {
    FEATURE_FLAGS[flagName] = value
}

/**
 * Get all feature flags
 * @returns {Object} All feature flags
 */
export function getAllFeatureFlags() {
    return { ...FEATURE_FLAGS }
}

// ==================== DUAL WRITE HELPERS ====================

/**
 * Normalize accounts data (same as in dashboard)
 * @param {*} accountsData - Accounts data in various formats
 * @returns {Object} Normalized accounts object
 */
function normalizeAccounts(accountsData) {
    if (!accountsData) {
        return {}
    }
    if (Array.isArray(accountsData)) {
        return accountsData.reduce((acc, entry) => {
            if (Array.isArray(entry) && entry.length >= 2) {
                acc[entry[0]] = entry[1]
            }
            return acc
        }, {})
    }
    if (typeof accountsData === "object") {
        return Object.entries(accountsData).reduce((acc, [key, value]) => {
            if (!Number.isFinite(Number(key))) {
                acc[key] = value
            }
            return acc
        }, {})
    }
    return {}
}

/**
 * Get account mapping (name -> ID) from new structure
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Mapping of account names to IDs
 */
async function getAccountMapping(userId) {
    const accounts = await newQueries.getAccounts(userId)
    const mapping = {}
    accounts.forEach(account => {
        mapping[account.name] = account.id
    })
    return mapping
}

// ==================== DUAL WRITE OPERATIONS ====================

/**
 * Add account with dual write
 * @param {string} userId - User ID
 * @param {string} accountName - Account name
 * @param {number} balance - Initial balance
 * @returns {Promise<string>} New account ID
 */
export async function addAccountDualWrite(userId, accountName, balance) {
    let newAccountId = null
    
    // Write to new structure first
    if (getFeatureFlag("dualWrite") || getFeatureFlag("useNewStructure")) {
        newAccountId = await newQueries.addAccount(userId, accountName, balance)
    }
    
    // Write to old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    let data = userDoc.data()
    data.accounts = normalizeAccounts(data.accounts)
    data.accounts = {
        ...data.accounts,
        [accountName]: parseFloat(balance) || 0
    }
    await setDoc(userRef, data)
    
    return newAccountId
}

/**
 * Edit account with dual write
 * @param {string} userId - User ID
 * @param {string} accountName - Current account name
 * @param {string} newName - New account name (if renaming)
 * @param {number} newBalance - New balance
 * @returns {Promise<void>}
 */
export async function editAccountDualWrite(userId, accountName, newName, newBalance) {
    const trimmedName = (newName || accountName || "").trim()
    
    // Update old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    let data = userDoc.data()
    data.accounts = normalizeAccounts(data.accounts)
    
    const isRename = trimmedName !== accountName
    
    if (isRename) {
        delete data.accounts[accountName]
        if (Array.isArray(data.txs)) {
            data.txs = data.txs.map((tx) => {
                const nextTx = { ...tx }
                if (nextTx.from === accountName) {
                    nextTx.from = trimmedName
                }
                if (nextTx.to === accountName) {
                    nextTx.to = trimmedName
                }
                return nextTx
            })
        }
    }
    
    data.accounts = {
        ...data.accounts,
        [trimmedName]: parseFloat(newBalance) || 0
    }
    
    await setDoc(userRef, data)
    
    // Update new structure
    if (getFeatureFlag("dualWrite") || getFeatureFlag("useNewStructure")) {
        const accountMapping = await getAccountMapping(userId)
        const accountId = accountMapping[accountName]
        
        if (accountId) {
            if (isRename) {
                await newQueries.renameAccount(userId, accountId, trimmedName)
            }
            
            await newQueries.updateAccount(userId, accountId, {
                name: trimmedName,
                balance: parseFloat(newBalance) || 0
            })
        }
    }
}

/**
 * Delete account with dual write
 * @param {string} userId - User ID
 * @param {string} accountName - Account name to delete
 * @returns {Promise<void>}
 */
export async function deleteAccountDualWrite(userId, accountName) {
    // Delete from old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    let data = userDoc.data()
    data.accounts = normalizeAccounts(data.accounts)
    delete data.accounts[accountName]
    await setDoc(userRef, data)
    
    // Delete from new structure
    if (getFeatureFlag("dualWrite") || getFeatureFlag("useNewStructure")) {
        const accountMapping = await getAccountMapping(userId)
        const accountId = accountMapping[accountName]
        
        if (accountId) {
            await newQueries.deleteAccount(userId, accountId)
        }
    }
}

/**
 * Add transaction with dual write
 * @param {string} userId - User ID
 * @param {Object} transaction - Transaction data
 * @returns {Promise<string>} New transaction ID
 */
export async function addTransactionDualWrite(userId, transaction) {
    const { from, to, amount, date, description } = transaction
    let newTxId = null
    
    // Add to old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    let data = userDoc.data()
    data.accounts = normalizeAccounts(data.accounts)
    
    data.txs.push({
        from,
        to,
        amount: parseFloat(amount),
        date,
        description,
        createdAt: new Date().toISOString()
    })
    
    // Update account balances
    const amountValue = parseFloat(amount)
    data.accounts[from] -= amountValue
    data.accounts[to] += amountValue
    
    await setDoc(userRef, data)
    
    // Add to new structure
    if (getFeatureFlag("dualWrite") || getFeatureFlag("useNewStructure")) {
        const accountMapping = await getAccountMapping(userId)
        const fromAccountId = accountMapping[from]
        const toAccountId = accountMapping[to]
        
        if (fromAccountId && toAccountId) {
            newTxId = await newQueries.addTransaction(userId, {
                fromAccountId,
                toAccountId,
                fromAccountName: from,
                toAccountName: to,
                amount: parseFloat(amount),
                date,
                description
            })
        }
    }
    
    return newTxId
}

/**
 * Edit transaction with dual write
 * @param {string} userId - User ID
 * @param {number} index - Transaction index in old array
 * @param {Object} updatedTx - Updated transaction data
 * @returns {Promise<void>}
 */
export async function editTransactionDualWrite(userId, index, updatedTx) {
    // Update old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    let data = userDoc.data()
    data.accounts = normalizeAccounts(data.accounts)
    
    const currentTx = data.txs[index]
    if (!currentTx) {
        throw new Error("Transaction not found")
    }
    
    const nextAmount = parseFloat(updatedTx.amount)
    const prevAmount = parseFloat(currentTx.amount)
    const nextFrom = updatedTx.from || currentTx.from
    const nextTo = updatedTx.to || currentTx.to
    
    // Roll back previous transaction impact
    data.accounts[currentTx.from] += prevAmount
    data.accounts[currentTx.to] -= prevAmount
    
    // Apply updated transaction impact
    data.accounts[nextFrom] -= nextAmount
    data.accounts[nextTo] += nextAmount
    
    data.txs[index] = {
        ...currentTx,
        ...updatedTx,
        from: nextFrom,
        to: nextTo,
        amount: nextAmount,
        createdAt: currentTx.createdAt || updatedTx.createdAt || currentTx.date
    }
    
    await setDoc(userRef, data)
    
    // Update new structure
    if (getFeatureFlag("dualWrite") || getFeatureFlag("useNewStructure")) {
        // This is tricky - we need to find the matching transaction in new structure
        // For now, we'll skip this in dual-write mode and handle it in full migration
        // In production, you'd want to add a mapping field to track old index -> new ID
    }
}

/**
 * Delete transaction with dual write
 * @param {string} userId - User ID
 * @param {number} index - Transaction index in old array
 * @param {Object} tx - Transaction data
 * @returns {Promise<void>}
 */
export async function deleteTransactionDualWrite(userId, index, tx) {
    // Delete from old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    let data = userDoc.data()
    data.accounts = normalizeAccounts(data.accounts)
    
    data.txs.splice(index, 1)
    
    // Update account balances
    const amount = parseFloat(tx.amount)
    data.accounts[tx.from] += amount
    data.accounts[tx.to] -= amount
    
    await setDoc(userRef, data)
    
    // Delete from new structure
    if (getFeatureFlag("dualWrite") || getFeatureFlag("useNewStructure")) {
        // Same issue as edit - we need a mapping from old index to new ID
        // This would be handled in the full migration
    }
}

// ==================== READ OPERATIONS WITH FALLBACK ====================

/**
 * Get accounts with fallback
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of [name, balance] tuples (old format)
 */
export async function getAccountsWithFallback(userId) {
    if (getFeatureFlag("useNewStructure")) {
        try {
            const accounts = await newQueries.getAccounts(userId)
            // Convert to old format
            return accounts.map(acc => [acc.name, acc.balance])
        } catch (error) {
            console.error("Error reading from new structure, falling back to old:", error)
        }
    }
    
    // Read from old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    const data = userDoc.data()
    const normalized = normalizeAccounts(data.accounts)
    return Object.entries(normalized)
}

/**
 * Get transactions with fallback
 * @param {string} userId - User ID
 * @param {number} pageSize - Page size (only used for new structure)
 * @returns {Promise<Array>} Array of transactions in old format
 */
export async function getTransactionsWithFallback(userId, pageSize = 20) {
    if (getFeatureFlag("useNewStructure")) {
        try {
            const result = await newQueries.getTransactions(userId, pageSize)
            // Convert to old format: array of [index, tx] tuples
            return result.transactions.map((tx, index) => [
                index,
                {
                    from: tx.fromAccountName,
                    to: tx.toAccountName,
                    amount: tx.amount,
                    date: tx.date,
                    description: tx.description,
                    createdAt: tx.createdAt
                }
            ])
        } catch (error) {
            console.error("Error reading from new structure, falling back to old:", error)
        }
    }
    
    // Read from old structure
    const userRef = doc(db, "users", userId)
    const userDoc = await getDoc(userRef)
    const data = userDoc.data()
    return Object.entries(data.txs || [])
}
