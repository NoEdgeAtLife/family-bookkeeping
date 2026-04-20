<script>
    import AccountsList from "../../components/AccountsList.svelte"
    import TransactionsList from "../../components/TransactionsList.svelte"
    import Calculator from "../../components/Calculator.svelte"
    import {
        addAccount as addAccountRecord,
        addTransaction as addTransactionRecord,
        deleteAccount as deleteAccountRecord,
        deleteTransaction as deleteTransactionRecord,
        getAccounts as getAccountsList,
        renameAccount as renameAccountRecord,
        updateAccount as updateAccountRecord,
        updateTransaction as updateTransactionRecord
    } from "../../lib/firebase/queries.js"
    import { authHandlers, authStore } from "../../store/store.js"

    let accounts = []
    let accountName = ""
    let amount = ""
    let transactions = []

    let fromAccount = ""
    let toAccount = ""
    let transactionAmount = ""
    let transactionDate = new Date().toISOString().split("T")[0]
    let transactionDescription = ""

    let transactionSubmitting = false
    let transactionStatus = ""
    let transactionError = ""
    let lastTransactionPayload = null
    let backgroundLoadingTransactions = false

    function normalizeAccounts(accountsData) {
        if (!accountsData) {
            return {}
        }

        if (Array.isArray(accountsData)) {
            return accountsData.reduce((acc, entry) => {
                if (Array.isArray(entry) && entry.length >= 2) {
                    acc[entry[0]] = toNumber(entry[1])
                }
                return acc
            }, {})
        }

        if (typeof accountsData === "object") {
            return Object.entries(accountsData).reduce((acc, [key, value]) => {
                if (!Number.isFinite(Number(key))) {
                    acc[key] = toNumber(value)
                }
                return acc
            }, {})
        }

        return {}
    }

    function normalizeAccountIds(accountIdsData) {
        if (!accountIdsData || typeof accountIdsData !== "object") {
            return {}
        }

        return Object.entries(accountIdsData).reduce((acc, [name, id]) => {
            if (name && typeof id === "string" && id.trim()) {
                acc[name] = id
            }
            return acc
        }, {})
    }

    function toAccountsObject(accountList = []) {
        return accountList.reduce((acc, account) => {
            if (!account?.name) {
                return acc
            }

            acc[account.name] = toNumber(account.balance)
            return acc
        }, {})
    }

    function toAccountIdMap(accountList = []) {
        return accountList.reduce((acc, account) => {
            if (account?.name && account?.id) {
                acc[account.name] = account.id
            }
            return acc
        }, {})
    }

    function toNumber(value, fallback = 0) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    function sortAccounts(entries = []) {
        return entries.slice().sort((a, b) => a[0].localeCompare(b[0]))
    }

    function normalizeDateString(value) {
        if (!value) {
            return ""
        }

        const parsedDate = new Date(value)
        if (Number.isNaN(parsedDate.getTime())) {
            return String(value)
        }

        return parsedDate.toISOString().split("T")[0]
    }

    function normalizeTransaction(tx = {}) {
        return {
            id: tx.id || "",
            from: tx.from || tx.fromAccountName || "",
            to: tx.to || tx.toAccountName || "",
            amount: toNumber(tx.amount),
            date: normalizeDateString(tx.date),
            description: tx.description || "",
            createdAt: tx.createdAt || tx.date || ""
        }
    }

    function normalizeTransactions(transactionsData = []) {
        if (Array.isArray(transactionsData)) {
            return transactionsData.map((tx) => normalizeTransaction(tx))
        }

        if (typeof transactionsData === "object") {
            return Object.values(transactionsData).map((tx) => {
                return normalizeTransaction(tx)
            })
        }

        return []
    }

    function toTimestamp(value) {
        if (!value) {
            return 0
        }

        const parsedDate = new Date(value)
        if (Number.isNaN(parsedDate.getTime())) {
            return 0
        }

        return parsedDate.getTime()
    }

    function sortTransactions(transactionList = []) {
        return transactionList.slice().sort((a, b) => {
            const dateDiff = toTimestamp(b.date) - toTimestamp(a.date)
            if (dateDiff !== 0) {
                return dateDiff
            }

            return toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
        })
    }

    function getCurrentUserId() {
        return $authStore?.user?.uid || null
    }

    function findTransactionById(transactionId, transactionList) {
        const targetId = String(transactionId || "")
        if (!targetId) {
            return null
        }

        const list = transactionList || normalizedStoreTransactions

        return list.find((transaction) => String(transaction?.id || "") === targetId) || null
    }

    async function refreshAccountState(userId) {
        const latestAccounts = await getAccountsList(userId)
        const nextAccounts = toAccountsObject(latestAccounts)
        const nextAccountIds = toAccountIdMap(latestAccounts)

        authStore.update((curr) => {
            return {
                ...curr,
                data: {
                    ...(curr?.data || {}),
                    accounts: nextAccounts,
                    accountIds: nextAccountIds
                }
            }
        })

        return nextAccountIds
    }

    async function resolveAccountIds(userId) {
        const accountIds = normalizeAccountIds($authStore?.data?.accountIds || {})
        if (Object.keys(accountIds).length > 0) {
            return accountIds
        }

        return await refreshAccountState(userId)
    }

    function updateAuthData(mutator) {
        authStore.update((curr) => {
            const currentData = curr?.data || {}
            const nextData = {
                ...currentData,
                accounts: normalizeAccounts(currentData.accounts),
                accountIds: normalizeAccountIds(currentData.accountIds),
                transactions: normalizeTransactions(currentData.transactions || [])
            }

            mutator(nextData)

            return {
                ...curr,
                data: nextData
            }
        })
    }

    function dismissTransactionStatus() {
        transactionStatus = ""
        transactionError = ""
    }

    function reloadDashboardData() {
        if (typeof window !== "undefined") {
            window.location.reload()
        }
    }

    $: normalizedStoreAccounts = normalizeAccounts($authStore?.data?.accounts)
    $: normalizedStoreAccountIds = normalizeAccountIds($authStore?.data?.accountIds)
    $: normalizedStoreTransactions = normalizeTransactions($authStore?.data?.transactions || [])
    $: accounts = sortAccounts(Object.entries(normalizedStoreAccounts))
    $: transactions = sortTransactions(normalizedStoreTransactions)
    $: backgroundLoadingTransactions = Boolean($authStore?.data?.transactionsMeta?.backgroundLoading)
    $: loadError = Boolean($authStore?.data?.transactionsMeta?.loadError)
    $: loadErrorMessage = $authStore?.data?.transactionsMeta?.loadErrorMessage || "Unable to load your latest data."

    let editAccount = async (currentName, nextName, nextAmount) => {
        const userId = getCurrentUserId()
        if (!userId) {
            throw new Error("Missing user")
        }

        const trimmedName = (nextName || currentName || "").trim()
        const parsedAmount = Number(nextAmount)
        if (!trimmedName || !Number.isFinite(parsedAmount)) {
            throw new Error("Invalid account payload")
        }

        if (Object.prototype.hasOwnProperty.call(normalizedStoreAccounts, trimmedName) && trimmedName !== currentName) {
            throw new Error("Account already exists")
        }

        let accountId = normalizedStoreAccountIds[currentName]
        if (!accountId) {
            const refreshedAccountIds = await refreshAccountState(userId)
            accountId = refreshedAccountIds[currentName]
        }

        if (!accountId) {
            throw new Error("Account not found")
        }

        const isRename = trimmedName !== currentName
        if (isRename) {
            await renameAccountRecord(userId, accountId, trimmedName)
        }
        await updateAccountRecord(userId, accountId, { balance: parsedAmount })

        updateAuthData((data) => {
            const nextAccounts = normalizeAccounts(data.accounts)
            const nextAccountIds = normalizeAccountIds(data.accountIds)

            if (isRename) {
                delete nextAccounts[currentName]
                delete nextAccountIds[currentName]
            }

            nextAccounts[trimmedName] = parsedAmount
            nextAccountIds[trimmedName] = accountId
            data.accounts = nextAccounts
            data.accountIds = nextAccountIds

            if (isRename) {
                data.transactions = normalizeTransactions(data.transactions).map((tx) => {
                    const normalizedTx = normalizeTransaction(tx)
                    if (normalizedTx.from === currentName) {
                        normalizedTx.from = trimmedName
                    }
                    if (normalizedTx.to === currentName) {
                        normalizedTx.to = trimmedName
                    }
                    return normalizedTx
                })
            }
        })

        if (fromAccount === currentName) {
            fromAccount = trimmedName
        }

        if (toAccount === currentName) {
            toAccount = trimmedName
        }
    }

    let deleteAccount = async (currentName) => {
        const userId = getCurrentUserId()
        if (!userId) {
            throw new Error("Missing user")
        }

        let accountId = normalizedStoreAccountIds[currentName]
        if (!accountId) {
            const refreshedAccountIds = await refreshAccountState(userId)
            accountId = refreshedAccountIds[currentName]
        }

        if (!accountId) {
            throw new Error("Account not found")
        }

        await deleteAccountRecord(userId, accountId)

        updateAuthData((data) => {
            const nextAccounts = normalizeAccounts(data.accounts)
            const nextAccountIds = normalizeAccountIds(data.accountIds)
            delete nextAccounts[currentName]
            delete nextAccountIds[currentName]
            data.accounts = nextAccounts
            data.accountIds = nextAccountIds
        })

        if (fromAccount === currentName) {
            fromAccount = ""
        }

        if (toAccount === currentName) {
            toAccount = ""
        }
    }

    let addAccount = async () => {
        const userId = getCurrentUserId()
        if (!userId) {
            return
        }

        const trimmedName = (accountName || "").trim()
        const parsedAmount = Number(amount)

        if (!trimmedName || !Number.isFinite(parsedAmount)) {
            return
        }

        if (Object.prototype.hasOwnProperty.call(normalizedStoreAccounts, trimmedName)) {
            return
        }

        const newAccountId = await addAccountRecord(userId, trimmedName, parsedAmount)

        updateAuthData((data) => {
            const nextAccounts = normalizeAccounts(data.accounts)
            const nextAccountIds = normalizeAccountIds(data.accountIds)
            nextAccounts[trimmedName] = parsedAmount
            nextAccountIds[trimmedName] = newAccountId
            data.accounts = nextAccounts
            data.accountIds = nextAccountIds
        })

        accountName = ""
        amount = ""
    }

    let submitTransaction = async (payload) => {
        const userId = getCurrentUserId()
        if (!userId) {
            transactionError = "Please log in again"
            return false
        }

        const from = (payload.from || "").trim()
        const to = (payload.to || "").trim()
        const parsedAmount = Number(payload.amount)
        const date = payload.date || new Date().toISOString().split("T")[0]
        const description = payload.description || ""

        if (!from || !to) {
            transactionError = "Please select both accounts"
            return false
        }

        if (!Number.isFinite(parsedAmount)) {
            transactionError = "Invalid amount"
            return false
        }

        const accountIds = await resolveAccountIds(userId)
        const fromAccountId = accountIds[from]
        const toAccountId = accountIds[to]

        if (!fromAccountId || !toAccountId) {
            transactionError = "Could not resolve selected accounts. Please retry."
            return false
        }

        transactionSubmitting = true
        transactionStatus = "Adding transaction..."
        transactionError = ""

        try {
            const transactionId = await addTransactionRecord(userId, {
                fromAccountId,
                toAccountId,
                fromAccountName: from,
                toAccountName: to,
                amount: parsedAmount,
                date,
                description
            })

            updateAuthData((data) => {
                const nextAccounts = normalizeAccounts(data.accounts)
                nextAccounts[from] = toNumber(nextAccounts[from]) - parsedAmount
                nextAccounts[to] = toNumber(nextAccounts[to]) + parsedAmount
                data.accounts = nextAccounts

                const nextTransactions = normalizeTransactions(data.transactions || [])
                nextTransactions.push(
                    normalizeTransaction({
                        id: transactionId || "",
                        from,
                        to,
                        amount: parsedAmount,
                        date,
                        description,
                        createdAt: new Date().toISOString()
                    })
                )

                data.transactions = nextTransactions
            })

            transactionStatus = "Transaction added"
            return true
        } catch (error) {
            console.error(error)
            transactionError = "Failed to add transaction. Please retry."
            return false
        } finally {
            transactionSubmitting = false
        }
    }

    let addTransaction = async () => {
        const payload = {
            from: fromAccount,
            to: toAccount,
            amount: transactionAmount,
            date: transactionDate,
            description: transactionDescription
        }

        lastTransactionPayload = payload
        const successful = await submitTransaction(payload)
        if (successful) {
            transactionAmount = ""
            transactionDescription = ""
        }
    }

    let retryAddTransaction = async () => {
        if (!lastTransactionPayload) {
            return
        }

        await submitTransaction(lastTransactionPayload)
    }

    let editTransaction = async (transactionId, updatedTx) => {
        const userId = getCurrentUserId()
        if (!userId) {
            throw new Error("Missing user")
        }

        const currentTransaction = findTransactionById(transactionId)
        if (!currentTransaction) {
            throw new Error("Transaction not found")
        }

        const nextFrom = (updatedTx.from || currentTransaction.from || "").trim()
        const nextTo = (updatedTx.to || currentTransaction.to || "").trim()
        const nextAmount = Number(updatedTx.amount)
        const nextDate = updatedTx.date || currentTransaction.date
        const nextDescription = updatedTx.description || ""

        if (!nextFrom || !nextTo || !Number.isFinite(nextAmount)) {
            throw new Error("Invalid transaction payload")
        }

        const accountIds = await resolveAccountIds(userId)
        const fromAccountId = accountIds[nextFrom]
        const toAccountId = accountIds[nextTo]

        if (!fromAccountId || !toAccountId) {
            throw new Error("Could not resolve selected accounts")
        }

        await updateTransactionRecord(userId, currentTransaction.id, {
            fromAccountId,
            toAccountId,
            fromAccountName: nextFrom,
            toAccountName: nextTo,
            amount: nextAmount,
            date: nextDate,
            description: nextDescription
        })

        updateAuthData((data) => {
            const nextAccounts = normalizeAccounts(data.accounts)
            const prevAmount = toNumber(currentTransaction.amount)

            nextAccounts[currentTransaction.from] = toNumber(nextAccounts[currentTransaction.from]) + prevAmount
            nextAccounts[currentTransaction.to] = toNumber(nextAccounts[currentTransaction.to]) - prevAmount
            nextAccounts[nextFrom] = toNumber(nextAccounts[nextFrom]) - nextAmount
            nextAccounts[nextTo] = toNumber(nextAccounts[nextTo]) + nextAmount
            data.accounts = nextAccounts

            const nextTransactions = normalizeTransactions(data.transactions || [])
            data.transactions = nextTransactions.map((transaction) => {
                if (transaction.id !== currentTransaction.id) {
                    return transaction
                }

                return normalizeTransaction({
                    ...transaction,
                    from: nextFrom,
                    to: nextTo,
                    amount: nextAmount,
                    date: nextDate,
                    description: nextDescription,
                    createdAt: transaction.createdAt || currentTransaction.createdAt || nextDate
                })
            })
        })
    }

    let deleteTransaction = async (transactionId, transactionData) => {
        const userId = getCurrentUserId()
        if (!userId) {
            throw new Error("Missing user")
        }

        const currentTransaction = findTransactionById(transactionId) || normalizeTransaction(transactionData)
        if (!currentTransaction.id) {
            throw new Error("Transaction id missing")
        }

        await deleteTransactionRecord(userId, currentTransaction.id)

        updateAuthData((data) => {
            const nextAccounts = normalizeAccounts(data.accounts)
            const amountValue = toNumber(currentTransaction.amount)

            nextAccounts[currentTransaction.from] = toNumber(nextAccounts[currentTransaction.from]) + amountValue
            nextAccounts[currentTransaction.to] = toNumber(nextAccounts[currentTransaction.to]) - amountValue
            data.accounts = nextAccounts

            const nextTransactions = normalizeTransactions(data.transactions || [])
            data.transactions = nextTransactions.filter((transaction) => {
                return transaction.id !== currentTransaction.id
            })
        })
    }
</script>

{#if !$authStore.loading}
  <div class="mainContainer">
    {#if loadError}
      <div class="loadErrorBanner" aria-live="polite">
        <span>{loadErrorMessage}</span>
        <button class="reload" on:click={reloadDashboardData}>Reload</button>
      </div>
    {/if}
    <div class="signoutContainer">
      <button on:click={() => authHandlers.logout()}>Sign Out</button>
    </div>
    <Calculator {accounts} />
  <div class="headerContainer">
    <h1>Accounts</h1>
  </div>
  <div class="formContainer">
    <input type="text" bind:value={accountName} placeholder="Account Name" />
    <input type="number" bind:value={amount} placeholder="$" />
    <button on:click={addAccount} disabled={!accountName.trim() || !Number.isFinite(Number(amount))}>Add Account</button>
  </div>

  <main>
    {#if accounts.length > 0}
      <AccountsList {accounts} {editAccount} {deleteAccount} />
    {:else}
      <p>No accounts found</p>
    {/if}
  <div class="transactionContainer">
    <h2>Transactions</h2>
    <div class="transactionForm">
      <div class="tf-row tf-accounts">
        <select bind:value={fromAccount}>
          <option value="">From account</option>
          {#each accounts as [accountName, amount]}
            <option value={accountName}>{accountName}</option>
          {/each}
        </select>
        <select bind:value={toAccount}>
          <option value="">To account</option>
          {#each accounts as [accountName, amount]}
            <option value={accountName}>{accountName}</option>
          {/each}
        </select>
      </div>
      <div class="tf-row tf-amount-desc">
        <input type="number" bind:value={transactionAmount} placeholder="$" />
        <input type="text" bind:value={transactionDescription} placeholder="Description" />
      </div>
      <div class="tf-row tf-date-add">
        <input type="date" bind:value={transactionDate} placeholder={transactionDate} />
        <button class="icon add" on:click={addTransaction} disabled={transactionSubmitting || !fromAccount || !toAccount || !Number.isFinite(Number(transactionAmount))} aria-label="Add transaction">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
    {#if transactionStatus || transactionError}
      <div class="txStatus" aria-live="polite">
        {#if transactionStatus}
          <span class="success">{transactionStatus}</span>
        {/if}
        {#if transactionError}
          <span class="error">{transactionError}</span>
          <button class="retry" on:click={retryAddTransaction} disabled={transactionSubmitting}>Retry</button>
        {/if}
        <button class="dismiss" on:click={dismissTransactionStatus} aria-label="Dismiss">✕</button>
      </div>
    {/if}
    <div class="transactionList">
      {#if backgroundLoadingTransactions}
        <p class="loadingHint" aria-live="polite">Loading more transactions in background...</p>
      {/if}
      {#if transactions.length > 0}
  <TransactionsList {transactions} {accounts} {editTransaction} {deleteTransaction} />
      {:else}
        <p>No transactions found</p>
      {/if}
    </div>
  </div>
  </main>
</div>
{:else}
  <div class="loadingState" aria-live="polite">
    Loading your dashboard...
  </div>
{/if}

<style>
  .loadingState {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
    text-align: center;
    color: #0f5f97;
    font-weight: 600;
  }
  .mainContainer {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }
  .loadErrorBanner {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid #b42318;
    border-radius: 6px;
    background: #ffe9e6;
    color: #7a271a;
    font-size: 0.9rem;
  }
  .loadErrorBanner .reload {
    min-height: 32px;
    padding: 4px 10px;
    background: #b42318;
    color: #fff;
    border: none;
    border-radius: 4px;
  }
  .headerContainer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 10px;
    gap: 10px;
    position: relative;
  }
  .headerContainer h1 {
    font-size: 1.5rem;
    margin: 0;
  }
  .signoutContainer {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    padding: 8px 0 0 0;
  }
  .signoutContainer button {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 6px 12px;
    min-height: 36px;
    border-radius: 6px;
    background-color: #007bff;
    color: #fff;
    border: none;
    cursor: pointer;
  }
  .formContainer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 10px;
    gap: 10px;
  }
  .formContainer input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    min-height: 36px;
    border-radius: 6px;
    border: 1px solid #e6e9ee;
    box-shadow: inset 0 1px 2px rgba(16,24,40,0.03);
  }
  .formContainer button {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 6px 12px;
    min-height: 36px;
    border-radius: 6px;
    background-color: #007bff;
    color: #fff;
  }
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 10px;
  }
  p {
    margin: 10px 0;
  }
  .transactionContainer {
    margin-top: 20px;
    width: 100%;
  }
  .transactionContainer h2 {
    font-size: 1.25rem;
    margin-bottom: 10px;
  }
  .loadingHint {
    margin: 4px 0 8px;
    font-size: 0.9rem;
    color: #0f5f97;
  }
  .transactionForm {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
    align-items: flex-start;
  }
  .transactionForm .tf-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .transactionForm .tf-row > * {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    min-height: 36px;
    border-radius: 6px;
    border: 1px solid #e6e9ee;
    box-shadow: inset 0 1px 2px rgba(16,24,40,0.03);
  }
  .transactionForm .tf-row .add {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #007bff;
    color: #fff;
    border: none;
    padding: 0;
  }
  .transactionForm .tf-row .add:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .txStatus {
    display: flex;
    gap: 10px;
    align-items: center;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10;
    padding: 8px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(6px);
    max-width: calc(100vw - 40px);
  }
  .txStatus .success {
    color: #1a7f37;
    font-weight: 600;
  }
  .txStatus .error {
    color: #b42318;
    font-weight: 600;
  }
  .txStatus .retry {
    border: 1px solid #b42318;
    background: transparent;
    color: #b42318;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    min-height: 44px;
  }
  .txStatus .dismiss {
    border: none;
    background: transparent;
    color: #333;
    cursor: pointer;
    font-size: 14px;
    min-width: 44px;
    min-height: 44px;
  }

  @media (max-width: 768px) {
    .loadErrorBanner {
      flex-direction: column;
      align-items: stretch;
    }
    .headerContainer h1 {
      font-size: 1.25rem;
    }
    .formContainer {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 0 6px;
    }
    .formContainer input {
      flex: 1 1 auto;
      margin-bottom: 0;
      min-width: 0;
    }
    .formContainer button {
      flex: 0 0 auto;
      width: auto;
      margin-bottom: 0;
      padding: 6px 10px;
    }
    .transactionForm {
      flex-direction: column;
      gap: 6px;
    }
    .transactionForm .tf-row {
      flex-direction: row;
    }
    .transactionForm .tf-accounts > *,
    .transactionForm .tf-amount-desc > * {
      flex: 1 1 50%;
    }
    .transactionForm .tf-date-add > input {
      flex: 1 1 auto;
    }
    .transactionForm .tf-date-add .add {
      margin-left: 8px;
    }
    .txStatus {
      flex-direction: column;
      align-items: stretch;
      left: 20px;
      right: 20px;
      bottom: 10px;
    }
  }
</style>
