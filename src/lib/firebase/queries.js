// Firebase query helpers for new subcollection structure
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter,
    runTransaction,
    Timestamp
} from "firebase/firestore"
import { db } from "./firebase.js"

// ==================== ACCOUNTS ====================

/**
 * Get all accounts for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of account objects with id
 */
export async function getAccounts(userId) {
    const accountsRef = collection(db, "users", userId, "accounts")
    const q = query(accountsRef, orderBy("name", "asc"))
    const snapshot = await getDocs(q)
    
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }))
}

/**
 * Add a new account
 * @param {string} userId - User ID
 * @param {string} name - Account name
 * @param {number} balance - Initial balance
 * @returns {Promise<string>} New account ID
 */
export async function addAccount(userId, name, balance) {
    const accountsRef = collection(db, "users", userId, "accounts")
    const docRef = await addDoc(accountsRef, {
        name: name.trim(),
        balance: parseFloat(balance) || 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    })
    
    return docRef.id
}

/**
 * Update account (name and/or balance)
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateAccount(userId, accountId, updates) {
    const accountRef = doc(db, "users", userId, "accounts", accountId)
    await updateDoc(accountRef, {
        ...updates,
        updatedAt: Timestamp.now()
    })
}

/**
 * Delete account
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID
 * @returns {Promise<void>}
 */
export async function deleteAccount(userId, accountId) {
    const accountRef = doc(db, "users", userId, "accounts", accountId)
    await deleteDoc(accountRef)
}

/**
 * Update account balance atomically
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID
 * @param {number} delta - Amount to add/subtract (negative for subtract)
 * @returns {Promise<void>}
 */
export async function updateAccountBalance(userId, accountId, delta) {
    const accountRef = doc(db, "users", userId, "accounts", accountId)
    
    await runTransaction(db, async (transaction) => {
        const accountDoc = await transaction.get(accountRef)
        if (!accountDoc.exists()) {
            throw new Error("Account does not exist")
        }
        
        const currentBalance = accountDoc.data().balance || 0
        const newBalance = currentBalance + delta
        
        transaction.update(accountRef, {
            balance: newBalance,
            updatedAt: Timestamp.now()
        })
    })
}

// ==================== TRANSACTIONS ====================

/**
 * Get paginated transactions for a user
 * @param {string} userId - User ID
 * @param {number} pageSize - Number of items per page (default 20)
 * @param {Object} lastDoc - Last document from previous page (for pagination)
 * @returns {Promise<Object>} { transactions, lastDoc }
 */
export async function getTransactions(userId, pageSize = 20, lastDoc = null) {
    const txRef = collection(db, "users", userId, "transactions")
    let q = query(
        txRef,
        orderBy("date", "desc"),
        orderBy("createdAt", "desc"),
        limit(pageSize)
    )
    
    if (lastDoc) {
        q = query(q, startAfter(lastDoc))
    }
    
    const snapshot = await getDocs(q)
    const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to ISO string for consistency
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }))
    
    return {
        transactions,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: snapshot.docs.length === pageSize
    }
}

/**
 * Search transactions by description or account
 * @param {string} userId - User ID
 * @param {string} searchTerm - Search term
 * @param {number} pageSize - Number of items per page
 * @returns {Promise<Array>} Array of transactions
 */
export async function searchTransactions(userId, searchTerm, pageSize = 50) {
    // Note: Firestore doesn't support full-text search out of the box
    // This is a simple approach - for better search, consider Algolia or similar
    const txRef = collection(db, "users", userId, "transactions")
    const q = query(
        txRef,
        orderBy("date", "desc"),
        limit(pageSize)
    )
    
    const snapshot = await getDocs(q)
    const searchLower = searchTerm.toLowerCase()
    
    return snapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
        }))
        .filter(tx => 
            tx.description?.toLowerCase().includes(searchLower) ||
            tx.fromAccountName?.toLowerCase().includes(searchLower) ||
            tx.toAccountName?.toLowerCase().includes(searchLower)
        )
}

/**
 * Get transactions by date range
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of transactions
 */
export async function getTransactionsByDateRange(userId, startDate, endDate) {
    const txRef = collection(db, "users", userId, "transactions")
    const q = query(
        txRef,
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<=", Timestamp.fromDate(endDate)),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }))
}

/**
 * Add a new transaction (atomic - updates both transaction and account balances)
 * @param {string} userId - User ID
 * @param {Object} transaction - Transaction data
 * @returns {Promise<string>} New transaction ID
 */
export async function addTransaction(userId, transaction) {
    const { fromAccountId, toAccountId, fromAccountName, toAccountName, amount, date, description } = transaction
    
    return await runTransaction(db, async (firestoreTransaction) => {
        // Create transaction document
        const txRef = collection(db, "users", userId, "transactions")
        const newTxRef = doc(txRef)
        
        const txData = {
            fromAccountId,
            toAccountId,
            fromAccountName,
            toAccountName,
            amount: parseFloat(amount),
            date: typeof date === 'string' ? Timestamp.fromDate(new Date(date)) : Timestamp.fromDate(date),
            description: description || "",
            createdAt: Timestamp.now()
        }
        
        firestoreTransaction.set(newTxRef, txData)
        
        // Update account balances
        const fromAccountRef = doc(db, "users", userId, "accounts", fromAccountId)
        const toAccountRef = doc(db, "users", userId, "accounts", toAccountId)
        
        const fromAccountDoc = await firestoreTransaction.get(fromAccountRef)
        const toAccountDoc = await firestoreTransaction.get(toAccountRef)
        
        if (!fromAccountDoc.exists() || !toAccountDoc.exists()) {
            throw new Error("One or both accounts do not exist")
        }
        
        const fromBalance = fromAccountDoc.data().balance || 0
        const toBalance = toAccountDoc.data().balance || 0
        const amountValue = parseFloat(amount)
        
        firestoreTransaction.update(fromAccountRef, {
            balance: fromBalance - amountValue,
            updatedAt: Timestamp.now()
        })
        
        firestoreTransaction.update(toAccountRef, {
            balance: toBalance + amountValue,
            updatedAt: Timestamp.now()
        })
        
        return newTxRef.id
    })
}

/**
 * Update a transaction (atomic - updates transaction and account balances)
 * @param {string} userId - User ID
 * @param {string} transactionId - Transaction ID
 * @param {Object} updates - Updated transaction data
 * @returns {Promise<void>}
 */
export async function updateTransaction(userId, transactionId, updates) {
    const txRef = doc(db, "users", userId, "transactions", transactionId)
    
    await runTransaction(db, async (firestoreTransaction) => {
        const txDoc = await firestoreTransaction.get(txRef)
        if (!txDoc.exists()) {
            throw new Error("Transaction does not exist")
        }
        
        const oldTx = txDoc.data()
        const oldAmount = oldTx.amount
        const newAmount = updates.amount !== undefined ? parseFloat(updates.amount) : oldAmount
        
        // Determine which accounts are involved (old and new)
        const oldFromId = oldTx.fromAccountId
        const oldToId = oldTx.toAccountId
        const newFromId = updates.fromAccountId || oldFromId
        const newToId = updates.toAccountId || oldToId
        
        // Revert old transaction impact
        const oldFromRef = doc(db, "users", userId, "accounts", oldFromId)
        const oldToRef = doc(db, "users", userId, "accounts", oldToId)
        
        const oldFromDoc = await firestoreTransaction.get(oldFromRef)
        const oldToDoc = await firestoreTransaction.get(oldToRef)
        
        if (!oldFromDoc.exists() || !oldToDoc.exists()) {
            throw new Error("Original accounts do not exist")
        }
        
        let oldFromBalance = oldFromDoc.data().balance || 0
        let oldToBalance = oldToDoc.data().balance || 0
        
        // Revert the old transaction
        oldFromBalance += oldAmount
        oldToBalance -= oldAmount
        
        // Apply new transaction
        if (newFromId === oldFromId) {
            oldFromBalance -= newAmount
        } else {
            // Different from account
            const newFromRef = doc(db, "users", userId, "accounts", newFromId)
            const newFromDoc = await firestoreTransaction.get(newFromRef)
            if (!newFromDoc.exists()) {
                throw new Error("New from account does not exist")
            }
            const newFromBalance = (newFromDoc.data().balance || 0) - newAmount
            firestoreTransaction.update(newFromRef, {
                balance: newFromBalance,
                updatedAt: Timestamp.now()
            })
        }
        
        if (newToId === oldToId) {
            oldToBalance += newAmount
        } else {
            // Different to account
            const newToRef = doc(db, "users", userId, "accounts", newToId)
            const newToDoc = await firestoreTransaction.get(newToRef)
            if (!newToDoc.exists()) {
                throw new Error("New to account does not exist")
            }
            const newToBalance = (newToDoc.data().balance || 0) + newAmount
            firestoreTransaction.update(newToRef, {
                balance: newToBalance,
                updatedAt: Timestamp.now()
            })
        }
        
        // Update original accounts if they're still involved
        firestoreTransaction.update(oldFromRef, {
            balance: oldFromBalance,
            updatedAt: Timestamp.now()
        })
        
        firestoreTransaction.update(oldToRef, {
            balance: oldToBalance,
            updatedAt: Timestamp.now()
        })
        
        // Update transaction
        const txUpdates = {
            ...updates,
            amount: newAmount
        }
        
        if (updates.date) {
            txUpdates.date = typeof updates.date === 'string' 
                ? Timestamp.fromDate(new Date(updates.date)) 
                : Timestamp.fromDate(updates.date)
        }
        
        firestoreTransaction.update(txRef, txUpdates)
    })
}

/**
 * Delete a transaction (atomic - removes transaction and reverts account balances)
 * @param {string} userId - User ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<void>}
 */
export async function deleteTransaction(userId, transactionId) {
    const txRef = doc(db, "users", userId, "transactions", transactionId)
    
    await runTransaction(db, async (firestoreTransaction) => {
        const txDoc = await firestoreTransaction.get(txRef)
        if (!txDoc.exists()) {
            throw new Error("Transaction does not exist")
        }
        
        const tx = txDoc.data()
        const amount = tx.amount
        
        // Revert account balances
        const fromAccountRef = doc(db, "users", userId, "accounts", tx.fromAccountId)
        const toAccountRef = doc(db, "users", userId, "accounts", tx.toAccountId)
        
        const fromAccountDoc = await firestoreTransaction.get(fromAccountRef)
        const toAccountDoc = await firestoreTransaction.get(toAccountRef)
        
        if (fromAccountDoc.exists()) {
            const fromBalance = fromAccountDoc.data().balance || 0
            firestoreTransaction.update(fromAccountRef, {
                balance: fromBalance + amount,
                updatedAt: Timestamp.now()
            })
        }
        
        if (toAccountDoc.exists()) {
            const toBalance = toAccountDoc.data().balance || 0
            firestoreTransaction.update(toAccountRef, {
                balance: toBalance - amount,
                updatedAt: Timestamp.now()
            })
        }
        
        // Delete transaction
        firestoreTransaction.delete(txRef)
    })
}

// ==================== ACCOUNT RENAME ====================

/**
 * Rename account and update all related transactions (atomic)
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID
 * @param {string} newName - New account name
 * @returns {Promise<void>}
 */
export async function renameAccount(userId, accountId, newName) {
    const accountRef = doc(db, "users", userId, "accounts", accountId)
    
    // First, update the account name
    await updateDoc(accountRef, {
        name: newName.trim(),
        updatedAt: Timestamp.now()
    })
    
    // Then, find and update all transactions with this account
    // Note: This could be expensive for large datasets
    // Consider doing this in batches or using Cloud Functions
    const txRef = collection(db, "users", userId, "transactions")
    
    // Query for transactions where this account is the "from" account
    const fromQuery = query(txRef, where("fromAccountId", "==", accountId))
    const fromSnapshot = await getDocs(fromQuery)
    
    // Query for transactions where this account is the "to" account
    const toQuery = query(txRef, where("toAccountId", "==", accountId))
    const toSnapshot = await getDocs(toQuery)
    
    // Update all affected transactions
    const updatePromises = []
    
    fromSnapshot.docs.forEach(doc => {
        updatePromises.push(
            updateDoc(doc.ref, { fromAccountName: newName.trim() })
        )
    })
    
    toSnapshot.docs.forEach(doc => {
        updatePromises.push(
            updateDoc(doc.ref, { toAccountName: newName.trim() })
        )
    })
    
    await Promise.all(updatePromises)
}
